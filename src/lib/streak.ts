// =========================================================================
// 🔥 สตรีค — จำนวน "วันที่เข้ามาฝึก" ที่ต่อเนื่องกันอยู่
//
// กติกา: ต้องเข้ามาฝึกอย่างน้อย 1 ครั้งภายใน 3 วัน ไม่งั้นสตรีครีเซ็ตเป็น 0
//        (เว้นได้ไม่เกิน 3 วัน — ห่างกัน 4 วันขึ้นไปถือว่าขาด)
//
// 🧠 ทำไมคำนวณสดจาก PlayHistory แทนที่จะเก็บคอลัมน์ไว้ใน User:
//    - ไม่ต้องเพิ่ม migration และไม่มีสถานะให้หลุด sync
//    - ย้อนหลังได้ทันที ผู้เล่นเก่าได้สตรีคตามประวัติจริงที่เคยเล่นไว้
//    - สตรีคขาดเองตามเวลาโดยไม่ต้องมี cron มาคอยรีเซ็ต
// =========================================================================

/** เว้นได้ไม่เกินกี่วันก่อนสตรีคขาด */
export const STREAK_GRACE_DAYS = 3

/** ย้อนดูประวัติแค่ 1 ปี — จำกัดขนาด query โดยเฉพาะหน้า Leaderboard ที่คิดทีเดียว 50 คน
 *  (สตรีคเกิน 365 วันแทบเป็นไปไม่ได้ และถ้าถึงจริงก็ยังโชว์ 365 ซึ่งไม่ผิดในทางปฏิบัติ) */
export const STREAK_LOOKBACK_DAYS = 365

/** วันที่เริ่มนับย้อนหลัง — ใช้เป็นเงื่อนไข `createdAt: { gte: ... }` ตอน query */
export const streakSince = (now: Date = new Date()): Date =>
  new Date(now.getTime() - STREAK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

// ผู้เล่นเป็นคนไทย — ตัดวันตามเวลาไทย (UTC+7) ไม่ใช่ UTC
// ไม่งั้นคนที่เล่นตอนตี 1 จะถูกนับเป็นวันก่อนหน้า
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** แปลงเวลาเป็น "เลขวันที่" ตามเวลาไทย (จำนวนวันนับจาก epoch)
 *  รับ string ด้วยเผื่อ driver คืนค่าเป็นข้อความแทน Date */
export const bangkokDayIndex = (date: Date | string): number =>
  Math.floor((new Date(date).getTime() + BANGKOK_OFFSET_MS) / DAY_MS)

/**
 * นับสตรีคจากรายการเวลาที่เคยเล่น (เรียงมาแบบไหนก็ได้)
 * คืนจำนวน "วันที่ฝึก" ที่ต่อเนื่องกันจนถึงครั้งล่าสุด
 * ถ้าครั้งล่าสุดห่างจากวันนี้เกิน 3 วัน = ขาดแล้ว คืน 0
 */
export const calcStreak = (playedAt: (Date | string)[], now: Date = new Date()): number => {
  if (playedAt.length === 0) return 0

  // ยุบให้เหลือวันละครั้ง แล้วเรียงจากใหม่ไปเก่า
  // กรองค่าที่แปลงเป็นวันไม่ได้ทิ้ง ไม่งั้น NaN จะทำให้ผลเพี้ยนทั้งก้อน
  const days = [...new Set(playedAt.map(bangkokDayIndex))]
    .filter((d) => Number.isFinite(d))
    .sort((a, b) => b - a)
  if (days.length === 0) return 0

  // ครั้งล่าสุดห่างเกินโควต้า = สตรีคขาดไปแล้ว
  if (bangkokDayIndex(now) - days[0] > STREAK_GRACE_DAYS) return 0

  // ไล่ย้อนหลังทีละวันที่เล่น หยุดทันทีที่เจอช่องว่างเกินโควต้า
  let streak = 1
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1] - days[i] > STREAK_GRACE_DAYS) break
    streak++
  }
  return streak
}
