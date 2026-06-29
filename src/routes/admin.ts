import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'

// 🌟 Import ยาม 2 คนมาเฝ้าประตู
import { authenticateToken, authorizeAdmin } from '../middlewares/auth'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = { user: { userId: string; username: string; role: string } }
const adminRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 🛑 ตั้งด่านตรวจ: ทุก API ในไฟล์นี้ต้องผ่าน 2 ยามนี้ก่อนเสมอ!
adminRoute.use('/*', authenticateToken, authorizeAdmin)

// ==========================================
// 🚀 API: ดึงโจทย์ทั้งหมด (สำหรับหน้า Dashboard Admin)
// ==========================================
adminRoute.get('/missions', async (c) => {
  try {
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })
    const missions = await prisma.mission.findMany({
      orderBy: [{ os: 'asc' }, { level: 'asc' }]
    })
    return c.json({ success: true, data: missions })
  } catch (error) {
    return c.json({ success: false, message: 'ดึงข้อมูลโจทย์ล้มเหลว' }, 500)
  }
})

// ==========================================
// 🚀 API: สร้างโจทย์ด่านใหม่
// ==========================================
adminRoute.post('/missions', async (c) => {
  try {
    const body = await c.req.json()
    const { os, difficulty, level, title, description, expectedCommand, hint, rewardExp } = body
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    const existingMission = await prisma.mission.findFirst({
      where: { os: os, level: parseInt(level) }
    })

    if (existingMission) {
      return c.json({ success: false, message: `โจทย์หมวด ${os} Level ${level} มีอยู่แล้ว!` }, 400)
    }

    const newMission = await prisma.mission.create({
      data: {
        os, difficulty: difficulty || 'basic', level: parseInt(level), title, description,
        expectedCommand, hint, rewardExp: parseInt(rewardExp) || 100 
      }
    })
    return c.json({ success: true, message: 'เพิ่มภารกิจใหม่สำเร็จ!', data: newMission }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหา' }, 500)
  }
})

// ==========================================
// 🚀 API: อัปเดต/แก้ไขโจทย์
// ==========================================
adminRoute.put('/missions/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const { title, description, expectedCommand, hint } = await c.req.json()
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    const updatedMission = await prisma.mission.update({
      where: { id },
      data: { title, description, expectedCommand, hint }
    })
    return c.json({ success: true, message: 'อัปเดตภารกิจสำเร็จ!', data: updatedMission })
  } catch (error) {
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหา' }, 500)
  }
})

// ==========================================
// 🚀 API: ลบโจทย์
// ==========================================
adminRoute.delete('/missions/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    await prisma.mission.delete({ where: { id } })
    return c.json({ success: true, message: 'ลบภารกิจออกจากระบบแล้ว' })
  } catch (error) {
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหา' }, 500)
  }
})

// ==========================================
// 🚀 API: กด Favorite โจทย์สำหรับ Admin
// ==========================================
adminRoute.put('/favorites', async (c) => {
  try {
    const authUser = c.get('user')
    const { missionId } = await c.req.json()
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    const user = await prisma.user.findUnique({ where: { id: authUser.userId } })
    if (!user) return c.json({ success: false, message: 'ไม่พบผู้ใช้' }, 404)

    // แปลงข้อมูลจาก SQLite String ให้กลับเป็น Array 
    let updatedFavorites: string[] = []
    try { if (user.adminFavorites) updatedFavorites = JSON.parse(user.adminFavorites) } catch (e) {}

    const isFavorited = updatedFavorites.includes(missionId)

    if (isFavorited) {
      updatedFavorites = updatedFavorites.filter(id => id !== missionId) // ลบออก
    } else {
      updatedFavorites.push(missionId) // เพิ่มเข้าไป
    }

    // แปลง Array กลับเป็น String แล้วเซฟลงฐานข้อมูล
    await prisma.user.update({
      where: { id: authUser.userId },
      data: { adminFavorites: JSON.stringify(updatedFavorites) }
    })

    return c.json({ success: true, isFavorited: !isFavorited, favorites: updatedFavorites })
  } catch (error) {
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหา' }, 500)
  }
})

export default adminRoute