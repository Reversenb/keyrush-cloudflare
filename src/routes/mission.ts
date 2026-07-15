import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { authenticateToken } from '../middlewares/auth'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = {
  user: { userId: string; username: string; role: string; tokenVersion: number }
}
const missionRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>()

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
      return c.json({ success: true, data: mission })
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
  userCommand: z.string().min(1) // สิ่งที่ผู้เล่นพิมพ์มา
})

// ==========================================
// 🎯 API 2: ตรวจคำตอบ (Server-side Validation)
// ==========================================
missionRoute.post('/verify', 
  zValidator('json', verifySchema, (result, c) => {
    if (!result.success) return c.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' }, 400)
  }),
  async (c) => {
  try {
    const { os, level, userCommand } = c.req.valid('json')
    
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

   return c.json({ 
  success: true, 
  isCorrect: isCorrect,
  message: isCorrect ? 'คำสั่งถูกต้อง!' : 'คำสั่งยังไม่ถูก ลองใหม่อีกครั้ง',
  correctAnswer: isCorrect ? mission.expectedCommand : undefined 
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