import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'
import { authenticateToken } from '../middlewares/auth'

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
// 🚀 API 3: อัปเดตโปรไฟล์ (ชื่อแสดง, รูป, ไบโอ)
// ==========================================
userRoute.put('/profile', async (c) => {
  try {
    const authUser = c.get('user')
    const { displayName, avatar, bio } = await c.req.json()
    
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
// 🚀 API 5: บันทึกเซฟเกม (อัปเลเวล & แจก EXP)
// ==========================================
userRoute.put('/progress', async (c) => {
  try {
    const authUser = c.get('user')
    const { os, level, wpm, accuracy } = await c.req.json()

    if (os !== 'linux' && os !== 'windows') return c.json({ success: false, message: 'OS ไม่ถูกต้อง' }, 400)

    const playedMissionLevel = parseInt(level, 10)
    if (isNaN(playedMissionLevel) || playedMissionLevel < 1 || playedMissionLevel > 100) {
      return c.json({ success: false, message: 'Level ผิดปกติ' }, 400)
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

    // 3. ถ้าเล่นด่านใหม่ ให้แจก EXP และอัปเลเวล
    if (!isReplaying) {
      const missionData = await prisma.mission.findFirst({
        where: { os: os, level: playedMissionLevel }
      })

      if (!missionData) return c.json({ success: false, message: 'ไม่พบข้อมูลภารกิจในระบบ' }, 404)

      const newExp = currentExp + missionData.rewardExp
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
      const parsedWpm = parseInt(wpm, 10)
      const parsedAccuracy = parseInt(accuracy, 10)

      if (parsedWpm >= 0 && parsedWpm <= 300 && parsedAccuracy >= 0 && parsedAccuracy <= 100) {
        await prisma.playHistory.create({
          data: {
            userId: authUser.userId,
            os: os,
            level: playedMissionLevel,
            wpm: parsedWpm,
            accuracy: parsedAccuracy
          }
        })
      }
    }

    const responseMessage = isReplaying ? 'บันทึกสถิติสำเร็จ! (ทบทวนด่านเก่า ไม่ได้รับ EXP เพิ่ม)' : 'บันทึกข้อมูลและรับ EXP สำเร็จ!'
    return c.json({ success: true, message: responseMessage, data: updatedUser })

  } catch (error) {
    console.error("Save Progress Error:", error)
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหาตอนเซฟเกม' }, 500)
  }
})

export default userRoute