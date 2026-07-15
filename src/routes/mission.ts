import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { sign, verify } from 'hono/jwt'
import { authenticateToken } from '../middlewares/auth'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = {
  user: { userId: string; username: string; role: string; tokenVersion: number }
}
const missionRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ==========================================
// 🎫 ค่าคงที่ของระบบตั๋ว server-authoritative
// ==========================================
const SESSION_TTL_SEC = 60 * 60          // sessionToken อยู่ได้ 1 ชม. (เผื่อผู้เล่นค่อยๆ ทำ)
const CLEARANCE_TTL_SEC = 60 * 15        // clearanceToken อยู่ได้ 15 นาที (เอาไปเซฟเกม)
const MAX_HUMAN_WPM = 400                // เพดานความเร็วพิมพ์ของมนุษย์ (สถิติโลก ~300) เกินนี้ = บอท
const nowSec = () => Math.floor(Date.now() / 1000)

// ==========================================
// 🚀 API 1: ดึงโจทย์ (ซ่อนเฉลย 100%)
// ==========================================
missionRoute.get('/:os/:level', async (c) => {
  try {
    const targetOs = c.req.param('os')
    const targetLevel = parseInt(c.req.param('level'), 10)

    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    const mission = await prisma.mission.findFirst({
      where: { os: targetOs, level: targetLevel },
      select: {
        id: true,
        os: true,
        difficulty: true,
        level: true,
        title: true,
        description: true,
        hint: true,
        rewardExp: true
        
      }
    })

    if (mission) {
      // 🎫 ออกตั๋วเริ่มด่าน (ฝังเวลาเริ่ม) — ผู้เล่นต้องส่งคืนตอน verify เพื่อพิสูจน์ว่าใช้เวลาเล่นจริง
      const sessionToken = await sign(
        { os: mission.os, level: mission.level, purpose: 'mission-start', startedAt: nowSec(), exp: nowSec() + SESSION_TTL_SEC },
        c.env.JWT_SECRET, 'HS256'
      )
      return c.json({ success: true, data: mission, sessionToken })
    } else {
      return c.json({ success: false, message: "ยังไม่ได้สร้างด่านนี้ครับMP!" }, 404)
    }
  } catch (error) {
    console.error("Get Mission Error:", error)
    return c.json({ success: false, message: "เซิร์ฟเวอร์มีปัญหา" }, 500)
  }
})

// ==========================================
// 🛡️ กฎ Zod สำหรับการส่งคำตอบมาตรวจ
// ==========================================
const verifySchema = z.object({
  os: z.enum(['linux', 'windows']),
  level: z.coerce.number().int().min(1),
  userCommand: z.string().min(1),      // สิ่งที่ผู้เล่นพิมพ์มา
  sessionToken: z.string().min(1)      // ตั๋วเริ่มด่านที่ได้ตอนดึงโจทย์
})

// ==========================================
// 🎯 API 2: ตรวจคำตอบ (Server-side Validation) — ต้อง login
// ==========================================
missionRoute.post('/verify',
  authenticateToken,
  zValidator('json', verifySchema, (result, c) => {
    if (!result.success) return c.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' }, 400)
  }),
  async (c) => {
  try {
    const authUser = c.get('user')
    const { os, level, userCommand, sessionToken } = c.req.valid('json')

    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    // ดึงเฉพาะเฉลยมาเช็คที่ฝั่ง Server (ไม่ต้องส่งกลับไปหา Client)
    const mission = await prisma.mission.findFirst({
      where: { os, level },
      select: { expectedCommand: true }
    })

    if (!mission) {
      return c.json({ success: false, message: 'ไม่พบโจทย์ด่านนี้' }, 404)
    }

    // เทียบคำตอบที่ผู้เล่นพิมพ์ กับ เฉลยในระบบ
    // (ใช้ .trim() ตัดช่องว่างหัวท้ายเผื่อผู้เล่นเผลอเคาะ spacebar)
    const isCorrect = userCommand.trim() === mission.expectedCommand.trim()

    // ตอบผิด — จบตรงนี้ ไม่ออกตั๋วผ่านด่าน
    if (!isCorrect) {
      return c.json({ success: true, isCorrect: false, message: 'คำสั่งยังไม่ถูก ลองใหม่อีกครั้ง' })
    }

    // ✅ ตอบถูก → ตรวจตั๋วเริ่มด่านก่อนออกตั๋วผ่าน
    let session: any
    try {
      session = await verify(sessionToken, c.env.JWT_SECRET, 'HS256')
    } catch {
      return c.json({ success: false, message: 'เซสชันด่านหมดอายุ กรุณาโหลดโจทย์ใหม่' }, 400)
    }
    // ตั๋วต้องเป็นของด่านนี้จริง กันเอาตั๋วด่านง่ายมาใช้ด่านยาก
    if (session.purpose !== 'mission-start' || session.os !== os || session.level !== level) {
      return c.json({ success: false, message: 'เซสชันด่านไม่ถูกต้อง' }, 400)
    }

    // 🤖 กันบอท: ถ้าตอบถูกเร็วกว่าเวลาที่มนุษย์พิมพ์คำสั่งนี้ได้เร็วสุด = ผิดปกติ
    const elapsedMs = Date.now() - Number(session.startedAt) * 1000
    const minHumanMs = (mission.expectedCommand.length / 5) / MAX_HUMAN_WPM * 60000
    if (elapsedMs < minHumanMs) {
      return c.json({ success: false, message: 'ตรวจพบการเล่นที่เร็วผิดปกติ' }, 403)
    }

    // 🎫 ออกตั๋วผ่านด่าน — ผูกกับ user + ด่านนี้ ใช้เป็นหลักฐานตอนเซฟเกม
    const clearanceToken = await sign(
      { userId: authUser.userId, os, level, purpose: 'clearance', exp: nowSec() + CLEARANCE_TTL_SEC },
      c.env.JWT_SECRET, 'HS256'
    )

    return c.json({
      success: true,
      isCorrect: true,
      message: 'คำสั่งถูกต้อง!',
      correctAnswer: mission.expectedCommand,
      clearanceToken
    })
  } catch (error) {
    console.error("Verify Command Error:", error)
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหาตอนตรวจคำตอบ' }, 500)
  }
})

// ==========================================
// 💡 กฎ Zod สำหรับการขอดูเฉลย
// ==========================================
const revealSchema = z.object({
  os: z.enum(['linux', 'windows']),
  level: z.coerce.number().int().min(1)
})

// ==========================================
// 💡 API 3: ขอดูเฉลย (ต้อง login) — แลกกับ EXP เหลือ 20%
// server จด usedReveal ลงตาราง Progress ทันที ผู้เล่นปฏิเสธทีหลังไม่ได้
// ==========================================
missionRoute.post('/reveal',
  authenticateToken,
  zValidator('json', revealSchema, (result, c) => {
    if (!result.success) return c.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' }, 400)
  }),
  async (c) => {
  try {
    const authUser = c.get('user')
    const { os, level } = c.req.valid('json')

    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    // กันการแอบส่องเฉลยด่านที่ยังปลดล็อกไม่ถึง
    const currentUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { linuxLevel: true, windowsLevel: true }
    })
    if (!currentUser) return c.json({ success: false, message: 'ไม่พบผู้ใช้' }, 404)

    const currentLevel = os === 'windows' ? currentUser.windowsLevel : currentUser.linuxLevel
    if (level > currentLevel) {
      return c.json({ success: false, message: 'คุณยังไม่ปลดล็อกด่านนี้!' }, 403)
    }

    const mission = await prisma.mission.findFirst({
      where: { os, level },
      select: { id: true, expectedCommand: true }
    })
    if (!mission) return c.json({ success: false, message: 'ไม่พบโจทย์ด่านนี้' }, 404)

    // จดถาวรว่าด่านนี้เคยกดดูเฉลย → ตอนเซฟเกมจะได้ EXP แค่ 20%
    await prisma.progress.upsert({
      where: { userId_missionId: { userId: authUser.userId, missionId: mission.id } },
      update: { usedReveal: true },
      create: { userId: authUser.userId, missionId: mission.id, usedReveal: true }
    })

    return c.json({ success: true, expectedCommand: mission.expectedCommand })
  } catch (error) {
    console.error("Reveal Command Error:", error)
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหาตอนขอเฉลย' }, 500)
  }
})

export default missionRoute