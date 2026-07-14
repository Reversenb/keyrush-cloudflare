import { verify } from 'hono/jwt'
import { getCookie } from 'hono/cookie'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { Context, Next } from 'hono'

// ==========================================
// 🛡️ ยามตรวจบัตรผ่าน (เช็คว่าล็อกอินหรือยัง)
// ==========================================
export const authenticateToken = async (c: Context, next: Next) => {
  // อ่านจาก HttpOnly cookie เป็นหลัก (Bearer header เก็บไว้เป็น fallback สำหรับ curl/ทดสอบ)
  const authHeader = c.req.header('Authorization')
  const token = getCookie(c, 'auth_token') || (authHeader && authHeader.split(' ')[1])

  if (!token) {
    return c.json({ success: false, message: 'กรุณาเข้าสู่ระบบ' }, 401)
  }

  try {
    const decoded = await verify(token, c.env.JWT_SECRET as string, 'HS256')

    // 🔒 เช็ค tokenVersion กับ DB — ถ้า user เคย logout/ถูก revoke แล้ว token เก่าจะใช้ไม่ได้ทันที
    // (trade-off: เพิ่ม DB read 1 ครั้งต่อ request ที่ต้อง auth)
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.userId as string },
      select: { tokenVersion: true },
    })

    if (!dbUser || dbUser.tokenVersion !== decoded.tokenVersion) {
      return c.json({ success: false, message: 'เซสชันถูกยกเลิกแล้ว กรุณาเข้าสู่ระบบใหม่' }, 401)
    }

    // แปะข้อมูล user ไว้ใน Context เพื่อให้ Route ถัดไปดึงไปใช้ได้
    c.set('user', decoded)
    await next()
  } catch (err) {
    // 401 (ไม่ใช่ 403) เพื่อให้ frontend redirect ไป login ได้ทุกเคสที่ auth ไม่ผ่าน
    return c.json({ success: false, message: 'บัตรผ่านหมดอายุหรือไม่ถูกต้อง' }, 401)
  }
}

// ==========================================
// 👑 ยามตรวจสิทธิ์ VIP (เช็คว่าเป็น Admin ไหม)
// ==========================================
export const authorizeAdmin = async (c: Context, next: Next) => {
  const user = c.get('user') as any
  
  if (user && user.role === 'admin') {
    await next()
  } else {
    return c.json({ success: false, message: 'Access Denied! พื้นที่นี้สำหรับ Admin เท่านั้น' }, 403)
  }
}