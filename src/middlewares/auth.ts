import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'
import { sign } from 'hono/jwt'

// 🌟 1. เพิ่ม GOOGLE_CLIENT_ID เข้ามาใน Bindings
type Bindings = { 
  DB: D1Database; 
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string; 
}
const authRoute = new Hono<{ Bindings: Bindings }>()

// ==========================================
// 🚀 API: เข้าสู่ระบบด้วย Google 
// ==========================================
authRoute.post('/google', async (c) => {
  try {
    const body = await c.req.json()
    const { access_token } = body

    if (!access_token) {
      return c.json({ success: false, message: 'ไม่มี Access Token ส่งมา' }, 400)
    }

    // 🛡️ แก้ไขข้อ 1 & 4: ตรวจสอบ Audience และ Error จาก Tokeninfo
    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${access_token}`)
    if (!tokenInfoRes.ok) {
      return c.json({ success: false, message: 'Token ไม่ถูกต้อง หรือหมดอายุแล้ว' }, 401)
    }
    
    const tokenInfo: any = await tokenInfoRes.json()

    // ตรวจสอบว่า Token นี้ถูกสร้างมาเพื่อ Client ID ของแอปเราจริงๆ (ป้องกันการขโมย Token จากแอปอื่น)
    if (tokenInfo.aud !== c.env.GOOGLE_CLIENT_ID) {
      return c.json({ success: false, message: 'Access Denied: Token ไม่ได้เป็นของระบบ KeyRush' }, 403)
    }

    // 🛡️ แก้ไขข้อ 4: จัดการ Error ตอนดึง UserInfo
    const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    })
    
    if (!googleRes.ok) {
      return c.json({ success: false, message: 'ไม่สามารถดึงข้อมูลโปรไฟล์จาก Google ได้' }, 401)
    }
    
    const userInfo: any = await googleRes.json()

    // 🛡️ แก้ไขข้อ 3: เช็ค email_verified เพื่อป้องกันอีเมลที่ยังไม่ได้รับการยืนยัน
    if (!userInfo.email || userInfo.email_verified !== true) {
      return c.json({ success: false, message: 'อีเมลนี้ยังไม่ได้รับการยืนยันจาก Google' }, 403)
    }

    // --- ส่วนเชื่อมต่อ Database และสร้าง JWT ด้านล่างนี้เหมือนเดิมทุกประการ ---
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
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, 
    }
    const token = await sign(payload, c.env.JWT_SECRET, 'HS256')

    return c.json({
      success: true,
      message: 'Google Login สำเร็จ!',
      token: token,
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

export default authRoute