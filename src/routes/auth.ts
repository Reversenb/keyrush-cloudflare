import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'
import { sign } from 'hono/jwt'
import { setCookie, deleteCookie } from 'hono/cookie'
import { authenticateToken } from '../middlewares/auth'
import { z } from 'zod' // 🌟 1. Import Zod
import { zValidator } from '@hono/zod-validator'


type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
}
type Variables = {
  user: { userId: string; username: string; role: string; tokenVersion: number }
}
const authRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// อายุ JWT 4 ชั่วโมง (เดิม 7 วัน)
const TOKEN_TTL_SECONDS = 60 * 60 * 4

// frontend (vercel.app) กับ backend (workers.dev) คนละโดเมนกัน จึงต้องใช้ SameSite=None + Secure
const AUTH_COOKIE = 'auth_token'
const CSRF_COOKIE = 'csrf_token'
const cookieOpts = {
  path: '/',
  secure: true,
  sameSite: 'None' as const,
  maxAge: TOKEN_TTL_SECONDS,
}

// ==========================================
// 🛡️ กฎ Zod สำหรับเช็คข้อมูลตอน Login
// ==========================================
const googleAuthSchema = z.object({
  
  access_token: z.string({ message: 'ต้องระบุ Access Token เป็นข้อความ' })
                 .min(1, { message: 'Access Token ห้ามเป็นค่าว่าง' })
})

// ==========================================
// 🚀 API: เข้าสู่ระบบด้วย Google [ติดเกราะ Zod]
// ==========================================
authRoute.post('/google', 
  zValidator('json', googleAuthSchema, (result, c) => {
    // 🌟 ถ้าคนยิงมาไม่มีข้อมูล Body หรือส่ง Text ธรรมดามา Zod จะบล็อกและตอบ 400 ทันที ไม่ยอมให้เซิร์ฟเวอร์พัง
    if (!result.success) {
      return c.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง กรุณาส่ง Access Token มาในรูปแบบ JSON' }, 400)
    }
  }),
  async (c) => {
  try {
    // 🌟 ดึงข้อมูลที่ผ่านการสแกนจาก Zod แล้ว (รับประกันว่ามี access_token แน่นอน)
    const { access_token } = c.req.valid('json')

    // 🛡️ ด่านตรวจที่ 1: ตรวจสอบ Audience และ Error จาก Tokeninfo
    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${access_token}`)
    if (!tokenInfoRes.ok) {
      return c.json({ success: false, message: 'Token ไม่ถูกต้อง หรือหมดอายุแล้ว' }, 401)
    }
    
    const tokenInfo: any = await tokenInfoRes.json()

   if (tokenInfo.aud !== c.env.GOOGLE_CLIENT_ID) {
      return c.json({
        success: false,
        message: 'Access Denied: Token ไม่ได้เป็นของระบบ KeyRush'
      }, 403)
    }

    // 🛡️ ด่านตรวจที่ 2: ดึง UserInfo พร้อมจัดการ Error
    const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    })
    
    if (!googleRes.ok) {
      return c.json({ success: false, message: 'ไม่สามารถดึงข้อมูลโปรไฟล์จาก Google ได้' }, 401)
    }
    
    const userInfo: any = await googleRes.json()

    // 🛡️ ด่านตรวจที่ 3: เช็ค email_verified
    if (!userInfo.email || userInfo.email_verified !== true) {
      return c.json({ success: false, message: 'อีเมลนี้ยังไม่ได้รับการยืนยันจาก Google' }, 403)
    }

    // --- ส่วนเชื่อมต่อ Database และออกบัตรผ่าน ---
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    let user = await prisma.user.findUnique({
      where: { email: userInfo.email }
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          username: userInfo.email.split('@')[0], 
          email: userInfo.email,
          googleId: userInfo.sub, 
          displayName: userInfo.name || userInfo.email.split('@')[0],
          avatar: userInfo.picture || 'Felix', 
        }
      })
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { 
          googleId: userInfo.sub,
          avatar: userInfo.picture || user.avatar 
        }
      })
    }

    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      tokenVersion: user.tokenVersion,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    }
    const token = await sign(payload, c.env.JWT_SECRET, 'HS256')

    // JWT อยู่ใน HttpOnly cookie — JS ฝั่งหน้าเว็บอ่านไม่ได้ ป้องกัน XSS ขโมย token
    setCookie(c, AUTH_COOKIE, token, { ...cookieOpts, httpOnly: true })
    // CSRF token (double-submit): ไม่ HttpOnly เพื่อให้ frontend อ่านไปแนบเป็น header ได้
    setCookie(c, CSRF_COOKIE, crypto.randomUUID(), { ...cookieOpts, httpOnly: false })

    return c.json({
      success: true,
      message: 'Google Login สำเร็จ!',
      user: {
        id: user.id, username: user.username, role: user.role,
        displayName: user.displayName, avatar: user.avatar,
        linuxLevel: user.linuxLevel, linuxExp: user.linuxExp,
        windowsLevel: user.windowsLevel, windowsExp: user.windowsExp
      }
    }, 200)

  } catch (error) {
    console.error("Google Login Error:", error)
    return c.json({ success: false, message: 'เกิดข้อผิดพลาดในระบบเซิร์ฟเวอร์' }, 500)
  }
})

// ==========================================
// 🚪 API: ออกจากระบบ — bump tokenVersion เพื่อ revoke ทุก token เก่า แล้วเคลียร์ cookie
// ==========================================
authRoute.post('/logout', authenticateToken, async (c) => {
  try {
    const user = c.get('user') as { userId: string }
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    await prisma.user.update({
      where: { id: user.userId },
      data: { tokenVersion: { increment: 1 } },
    })

    deleteCookie(c, AUTH_COOKIE, { path: '/', secure: true, sameSite: 'None' })
    deleteCookie(c, CSRF_COOKIE, { path: '/', secure: true, sameSite: 'None' })
    return c.json({ success: true, message: 'ออกจากระบบเรียบร้อย' })
  } catch (error) {
    console.error('Logout Error:', error)
    return c.json({ success: false, message: 'เกิดข้อผิดพลาดในระบบเซิร์ฟเวอร์' }, 500)
  }
})

export default authRoute