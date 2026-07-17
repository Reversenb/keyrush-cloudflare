import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'
import { authenticateToken } from '../middlewares/auth'
import { verify } from 'hono/jwt'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'

// 🌟 ผูก Type ให้ TypeScript รู้จักตัวแปร Environment และ Variables (ข้อมูล user จาก Token)
type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = { user: { userId: string; username: string; role: string } }

const userRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ==========================================
// 🚀 API 1: ดูโปรไฟล์ผู้เล่นคนอื่น (ไม่ต้องล็อกอิน)
// ==========================================
userRoute.get('/profile/public/:username', async (c) => {
  try {
    const username = c.req.param('username')
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { displayName: username }
        ]
      },
      select: {
        id: true, username: true, displayName: true, avatar: true, bio: true, role: true,
        linuxLevel: true, linuxExp: true, windowsLevel: true, windowsExp: true, createdAt: true
      }
    })

    if (!user) return c.json({ success: false, message: 'ไม่พบผู้ใช้นี้ในระบบ' }, 404)
    return c.json({ success: true, data: user })
  } catch (error) {
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหา' }, 500)
  }
})

// 🌟 เปิดใช้งาน Middleware (ยามเฝ้าประตู) สำหรับ Route ด้านล่างทั้งหมด!
userRoute.use('/*', authenticateToken)

// ==========================================
// 🚀 API 2: ดึงข้อมูลโปรไฟล์ของตัวเอง
// ==========================================
userRoute.get('/progress', async (c) => {
  try {
    const authUser = c.get('user')
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: {
        id: true, username: true, displayName: true, avatar: true, bio: true, role: true,
        linuxLevel: true, linuxExp: true, windowsLevel: true, windowsExp: true,
        adminFavorites: true, createdAt: true
      }
    })

    if (!user) return c.json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้' }, 404)

    // แปลง String กลับเป็น Array เพราะ SQLite เก็บ Array ตรงๆ ไม่ได้
    let favoriteMissions = []
    try { favoriteMissions = JSON.parse(user.adminFavorites) } catch (e) {}

    return c.json({ success: true, data: { ...user, favoriteMissions } })
  } catch (error) {
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหา' }, 500)
  }
})

// ==========================================
// 🛡️ กฎ Zod สำหรับเช็คข้อมูลตอนอัปเดตโปรไฟล์
// ==========================================
const profileSchema = z.object({
  displayName: z.string().max(50, 'ชื่อแสดงยาวเกินไป').optional(),
  avatar: z.string().optional(),
  bio: z.string().max(500, 'ประวัติยาวเกินไป').optional()
})

// ==========================================
// 🚀 API 3: อัปเดตโปรไฟล์ (ชื่อแสดง, รูป, ไบโอ) [ติดเกราะ Zod]
// ==========================================
userRoute.put('/profile', 
  zValidator('json', profileSchema, (result, c) => {
    if (!result.success) {
      return c.json({ success: false, message: 'ข้อมูลโปรไฟล์ไม่ถูกต้อง (Zod Blocked)' }, 400)
    }
  }),
  async (c) => {
  try {
    const authUser = c.get('user')
    const { displayName, avatar, bio } = c.req.valid('json') // 🌟 ดึงข้อมูลที่ Zod สแกนแล้ว
    
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    const updatedUser = await prisma.user.update({
      where: { id: authUser.userId },
      data: { displayName, avatar, bio }
    })

    return c.json({ success: true, message: 'อัปเดตโปรไฟล์สำเร็จ!', data: updatedUser })
  } catch (error) {
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหา' }, 500)
  }
})

// ==========================================
// 🚀 API 4: ดึงสถิติการเล่น (WPM, Accuracy, ประวัติ)
// ==========================================
userRoute.get('/stats', async (c) => {
  try {
    const authUser = c.get('user')
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    const history = await prisma.playHistory.findMany({
      where: { userId: authUser.userId },
      orderBy: { createdAt: 'asc' }
    })

    let avgAccuracy = 0, avgWpm = 0
    let recentWpm: number[] = [], recentLessons: typeof history = []

    if (history.length > 0) {
      avgAccuracy = Math.round(history.reduce((sum, p) => sum + p.accuracy, 0) / history.length)
      avgWpm = Math.round(history.reduce((sum, p) => sum + p.wpm, 0) / history.length)
      recentWpm = history.slice(-6).map(p => p.wpm)
      recentLessons = [...history].reverse().slice(0, 5)
    }

    return c.json({ success: true, data: { avgAccuracy, avgWpm, recentWpm, recentLessons } })
  } catch (error) {
    return c.json({ success: false, message: 'ดึงสถิติไม่สำเร็จ' }, 500)
  }
})

// ==========================================
// 🚀 API 4.5: ดึงประวัติการเล่นทั้งหมด (สำหรับหน้า History — ไม่ตัดเหลือ 5 รายการแบบ /stats)
// ==========================================
userRoute.get('/history', async (c) => {
  try {
    const authUser = c.get('user')
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    const history = await prisma.playHistory.findMany({
      where: { userId: authUser.userId },
      orderBy: { createdAt: 'desc' },
      take: 500 // กันข้อมูลบวมเกินจำเป็น — ครอบคลุมการเล่นหลายเดือน
    })

    return c.json({ success: true, data: history })
  } catch (error) {
    console.error('Get History Error:', error)
    return c.json({ success: false, message: 'ดึงประวัติไม่สำเร็จ' }, 500)
  }
})

// ==========================================
// 🛡️ กฎ Zod สำหรับเช็คข้อมูลตอนบันทึกเซฟเกม
// ==========================================
const progressSchema = z.object({
  // 🌟 แก้ตรงนี้: ใช้คำว่า message แทน errorMap ได้เลยครับ
  os: z.enum(['linux', 'windows'], { message: 'ระบบขัดข้อง: OS ไม่ถูกต้อง' }),
  level: z.coerce.number().int().min(1).max(100, { message: 'Level ผิดปกติ' }),
  wpm: z.coerce.number().int().min(0).max(300).optional(),
  accuracy: z.coerce.number().int().min(0).max(100).optional(),
  // ตั๋วผ่านด่านที่ได้จาก /mission/verify — เป็นหลักฐานว่าเล่นผ่านจริง (กันฟาร์ม EXP)
  clearanceToken: z.string().min(1, { message: 'ขาดหลักฐานการผ่านด่าน' })
})

// ==========================================
// 🚀 API 5: บันทึกเซฟเกม (อัปเลเวล & แจก EXP) [ติดเกราะ Zod]
// ==========================================
userRoute.put('/progress', 
  // 🌟 ด่านตรวจ Zod: ป้องกันการส่งคะแนนผี หรือข้อมูลขยะ
  zValidator('json', progressSchema, (result, c) => {
    if (!result.success) {
      console.error("🚨 Hacker Detected or Bad Data:", result.error.issues)
      return c.json({ success: false, message: 'ข้อมูลเซฟเกมไม่ถูกต้อง (Zod Blocked)' }, 400)
    }
  }), 
  async (c) => {
  try {
    const authUser = c.get('user')
    // 🌟 ดึงข้อมูลจาก valid('json') แทน await c.req.json() เพื่อให้ได้ข้อมูลที่ปลอดภัย 100%
    const { os, level: playedMissionLevel, wpm, accuracy, clearanceToken } = c.req.valid('json')

    // 🎫 ตรวจตั๋วผ่านด่าน: ต้องมาจาก /mission/verify ที่ตอบถูกจริงเท่านั้น
    // ปิดช่องฟาร์ม EXP ด้วยการยิง endpoint นี้ตรงๆ โดยไม่เล่นเกม
    let clearance: any
    try {
      clearance = await verify(clearanceToken, c.env.JWT_SECRET as string, 'HS256')
    } catch {
      return c.json({ success: false, message: 'หลักฐานการผ่านด่านหมดอายุหรือไม่ถูกต้อง' }, 403)
    }
    if (
      clearance.purpose !== 'clearance' ||
      clearance.userId !== authUser.userId ||
      clearance.os !== os ||
      clearance.level !== playedMissionLevel
    ) {
      return c.json({ success: false, message: 'หลักฐานการผ่านด่านไม่ตรงกับด่านที่ส่งมา' }, 403)
    }

    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    // 1. ดึงข้อมูลผู้เล่นปัจจุบัน
    const currentUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { linuxLevel: true, linuxExp: true, windowsLevel: true, windowsExp: true }
    })

    if (!currentUser) return c.json({ success: false, message: 'ไม่พบผู้ใช้' }, 404)

    const currentLevel = os === 'windows' ? currentUser.windowsLevel : currentUser.linuxLevel
    const currentExp = os === 'windows' ? currentUser.windowsExp : currentUser.linuxExp

    // 2. ป้องกันการข้ามด่าน
    if (playedMissionLevel > currentLevel) {
      return c.json({ success: false, message: 'คุณยังไม่ปลดล็อกด่านนี้!' }, 403)
    }

    const isReplaying = playedMissionLevel < currentLevel
    let updatedUser = null
    let earnedExp = 0

    // 3. ถ้าเล่นด่านใหม่ ให้แจก EXP และอัปเลเวล
    if (!isReplaying) {
      const missionData = await prisma.mission.findFirst({
        where: { os: os, level: playedMissionLevel }
      })

      if (!missionData) return c.json({ success: false, message: 'ไม่พบข้อมูลภารกิจในระบบ' }, 404)

      // 💡 เคยกดดูเฉลยด่านนี้ → ได้ EXP แค่ 20% (server เป็นคนจดตอนกดเฉลย โกงไม่ได้)
      const revealRecord = await prisma.progress.findUnique({
        where: { userId_missionId: { userId: authUser.userId, missionId: missionData.id } },
        select: { usedReveal: true }
      })
      earnedExp = revealRecord?.usedReveal
        ? Math.floor(missionData.rewardExp * 0.2)
        : missionData.rewardExp

      const newExp = currentExp + earnedExp
      const newLevel = currentLevel + 1

      const updateData = os === 'windows'
        ? { windowsLevel: newLevel, windowsExp: newExp }
        : { linuxLevel: newLevel, linuxExp: newExp }

      updatedUser = await prisma.user.update({
        where: { id: authUser.userId },
        data: updateData
      })
    } else {
      updatedUser = await prisma.user.findUnique({ where: { id: authUser.userId } })
    }

    // 4. เซฟสถิติ (WPM/Accuracy) ลง PlayHistory
    if (wpm !== undefined && accuracy !== undefined) {
      await prisma.playHistory.create({
        data: {
          userId: authUser.userId,
          os: os,
          level: playedMissionLevel,
          wpm: wpm,
          accuracy: accuracy,
          earnedExp: earnedExp // ค่าเดียวกับที่ตอบใน response (0 ถ้าเป็นรอบเล่นซ้ำ)
        }
      })
    }

    const responseMessage = isReplaying ? 'บันทึกสถิติสำเร็จ! (ทบทวนด่านเก่า ไม่ได้รับ EXP เพิ่ม)' : 'บันทึกข้อมูลและรับ EXP สำเร็จ!'
    return c.json({ success: true, message: responseMessage, earnedExp, data: updatedUser })

  } catch (error) {
    console.error("Save Progress Error:", error)
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหาตอนเซฟเกม' }, 500)
  }
})

export default userRoute