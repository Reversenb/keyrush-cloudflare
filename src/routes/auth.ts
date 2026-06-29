    import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'
import { sign } from 'hono/jwt'

// 🌟 ผูก Type ให้ TypeScript รู้ว่าเรามีตัวแปร DB และ JWT_SECRET
type Bindings = { DB: D1Database; JWT_SECRET: string }
const authRoute = new Hono<{ Bindings: Bindings }>()

// ==========================================
// 🚀 API: เข้าสู่ระบบด้วย Google อย่างเดียว (No Password)
// ==========================================
authRoute.post('/google', async (c) => {
  try {
    // 1. รับ access_token จากหน้าบ้าน (Next.js)
    const body = await c.req.json()
    const { access_token } = body

    if (!access_token) {
      return c.json({ success: false, message: 'ไม่มี Access Token ส่งมา' }, 400)
    }

    // 2. เอา Token ไปถาม Google ว่าคนนี้คือใคร
    const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    })
    const userInfo: any = await googleRes.json()

    if (!userInfo.email) {
      return c.json({ success: false, message: 'ไม่สามารถดึงข้อมูลอีเมลจาก Google ได้' }, 401)
    }

    // 3. เชื่อมต่อฐานข้อมูล D1
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    // 4. เช็คว่ามีอีเมลนี้ในระบบหรือยัง
    let user = await prisma.user.findUnique({
      where: { email: userInfo.email }
    })

    // 5. ถ้ายังไม่มี (เด็กใหม่) -> สร้างบัญชีให้ทันทีอัตโนมัติ!
    if (!user) {
      user = await prisma.user.create({
        data: {
          username: userInfo.email.split('@')[0], // เอาชื่อหน้า @ มาเป็น username ชั่วคราว
          email: userInfo.email,
          googleId: userInfo.sub, // ไอดีเฉพาะจาก Google
          displayName: userInfo.name || userInfo.email.split('@')[0],
          avatar: userInfo.picture || 'Felix', // ใช้รูปโปรไฟล์จาก Google
        }
      })
    } 
    // 6. ถ้ามีบัญชีอยู่แล้ว (คนเก่า) แต่อาจจะยังไม่ได้อัปเดตรูป/ไอดี Google
    else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { 
          googleId: userInfo.sub,
          avatar: userInfo.picture || user.avatar // อัปเดตรูปให้เป็นปัจจุบัน
        }
      })
    }

    // 7. สร้างบัตรผ่าน JWT (อายุ 7 วัน)
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 วัน
    }
    const token = await sign(payload, c.env.JWT_SECRET, 'HS256')

    // 8. ส่ง Token และข้อมูลกลับไปให้หน้าบ้าน
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
    return c.json({ success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ Google' }, 500)
  }
})

export default authRoute