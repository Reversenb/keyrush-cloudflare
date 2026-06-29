import { verify } from 'hono/jwt'
import type { Context, Next } from 'hono'

// ==========================================
// 🛡️ ยามตรวจบัตรผ่าน (เช็คว่าล็อกอินหรือยัง)
// ==========================================
export const authenticateToken = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return c.json({ success: false, message: 'กรุณาเข้าสู่ระบบ' }, 401)
  }

  try {
    
    const decoded = await verify(token, c.env.JWT_SECRET as string, 'HS256')
    
    // แปะข้อมูล user ไว้ใน Context เพื่อให้ Route ถัดไปดึงไปใช้ได้ (เหมือน req.user ของเก่า)
    c.set('user', decoded) 
    await next()
  } catch (err) {
    return c.json({ success: false, message: 'บัตรผ่านหมดอายุหรือไม่ถูกต้อง' }, 403)
  }
}

// ==========================================
// 👑 ยามตรวจสิทธิ์ VIP (เช็คว่าเป็น Admin ไหม)
// ==========================================
export const authorizeAdmin = async (c: Context, next: Next) => {
  // ดึงข้อมูล user ที่ได้จาก authenticateToken ด้านบน
  const user = c.get('user') as any
  
  if (user && user.role === 'admin') {
    await next()
  } else {
    return c.json({ success: false, message: 'Access Denied! พื้นที่นี้สำหรับ Admin เท่านั้น' }, 403)
  }
}