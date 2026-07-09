// ไฟล์: src/middlewares/rateLimit.ts
import type { Context, Next } from 'hono'

// สร้างสมุดจด (Memory) ไว้จำว่า IP ไหนยิงมาแล้วกี่ครั้ง
// รูปแบบ: Map<IP Address, { จำนวนครั้ง, เวลาที่จะล้างประวัติ }>
const requestCounts = new Map<string, { count: number; resetTime: number }>()

export const rateLimiter = async (c: Context, next: Next) => {
  // 1. ดึง IP ของคนที่ยิง API มา (Cloudflare จะแนบมาใน Header นี้เสมอ)
  const ip = c.req.header('cf-connecting-ip') || 'unknown-ip'
  
  // ⚙️ ตั้งค่าความเข้มงวด
  const LIMIT = 30 // ห้ามยิงเกิน 30 ครั้ง
  const WINDOW_MS = 60 * 1000 // ในระยะเวลา 1 นาที (60,000 มิลลิวินาที)

  const now = Date.now()
  let record = requestCounts.get(ip)

  // 2. ถ้าเพิ่งเคยยิงมาครั้งแรก หรือประวัติเก่าหมดอายุไปแล้ว (เกิน 1 นาที) ให้เริ่มจดใหม่
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + WINDOW_MS }
  } else {
    // 3. ถ้ายิงซ้ำใน 1 นาที ให้บวกแต้มสแปมเพิ่มขึ้นไป
    record.count += 1
  }

  // เซฟประวัติกลับลงสมุดจด
  requestCounts.set(ip, record)

  // 🚨 4. เช็คว่าแต้มสแปมเกินที่กำหนดไหม
  if (record.count > LIMIT) {
    console.warn(`🚨 Rate Limit บล็อก IP: ${ip} (ยิงมา ${record.count} ครั้งรวด)`)
    // ตอบกลับด้วย Code 429: Too Many Requests
    return c.json({ 
      success: false, 
      message: 'คุณส่งคำขอเร็วเกินไป เซิร์ฟเวอร์รับไม่ทัน กรุณารอ 1 นาทีแล้วลองใหม่' 
    }, 429) 
  }

  // ถ้ายังไม่เกินโควต้า ก็ให้เข้าไปทำงานใน API ได้ตามปกติ
  await next()
}