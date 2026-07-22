import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'
import { z } from 'zod' // 🌟 1. Import Zod
import { zValidator } from '@hono/zod-validator' // 🌟 2. Import ตัวตรวจจับของ Hono

// 🌟 Import ยาม 2 คนมาเฝ้าประตู
import { authenticateToken, authorizeAdmin } from '../middlewares/auth'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = { user: { userId: string; username: string; role: string } }
const adminRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 🛑 ตั้งด่านตรวจ: ทุก API ในไฟล์นี้ต้องผ่าน 2 ยามนี้ก่อนเสมอ!
adminRoute.use('/*', authenticateToken, authorizeAdmin)

// ==========================================
// 🛡️ กฎ Zod สำหรับการสร้างและแก้ไขด่าน
// ==========================================
const missionCreateSchema = z.object({
  os: z.enum(['linux', 'windows'], { message: 'OS ต้องเป็น linux หรือ windows เท่านั้น' }),
  difficulty: z.string().optional().default('basic'),
  level: z.coerce.number().int().min(1, { message: 'Level ต้องเป็นตัวเลขที่มากกว่า 0' }),
  title: z.string().min(1, { message: 'ต้องระบุชื่อโจทย์' }),
  description: z.string().min(1, { message: 'ต้องระบุคำอธิบาย' }),
  expectedCommand: z.string().min(1, { message: 'ต้องระบุคำสั่งที่ถูกต้อง' }),
  hint: z.string().optional(),
  rewardExp: z.coerce.number().int().optional().default(100)
})

const missionUpdateSchema = z.object({
  title: z.string().min(1, { message: 'ต้องระบุชื่อโจทย์' }).optional(),
  description: z.string().min(1, { message: 'ต้องระบุคำอธิบาย' }).optional(),
  expectedCommand: z.string().min(1, { message: 'ต้องระบุคำสั่งที่ถูกต้อง' }).optional(),
  hint: z.string().optional()
})

const favoriteSchema = z.object({
  missionId: z.string().min(1, { message: 'ต้องระบุ ID ของโจทย์' })
})

// 🔀 สลับ level ของโจทย์สองข้อ (เนื้อหาคงเดิม แลกกันแค่เลขด่าน)
const missionSwapSchema = z.object({
  idA: z.string().min(1, { message: 'ต้องระบุโจทย์ข้อแรก' }),
  idB: z.string().min(1, { message: 'ต้องระบุโจทย์ข้อที่สอง' })
})

// ↕️ เรียงลำดับใหม่ทั้งหมวด — ส่ง id เรียงตามลำดับที่ต้องการ แล้วไล่เลข 1..N ให้
const missionReorderSchema = z.object({
  os: z.enum(['linux', 'windows'], { message: 'OS ต้องเป็น linux หรือ windows เท่านั้น' }),
  orderedIds: z.array(z.string().min(1)).min(1, { message: 'ต้องมีอย่างน้อย 1 โจทย์' })
})

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
// 🚀 API: สร้างโจทย์ด่านใหม่ [ติดเกราะ Zod]
// ==========================================
adminRoute.post('/missions', 
  zValidator('json', missionCreateSchema, (result, c) => {
    if (!result.success) return c.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', error: result.error.issues }, 400)
  }),
  async (c) => {
  try {
    // 🌟 ใช้ valid('json') Zod จะทำหน้าที่แปลง level และ rewardExp ให้เป็นตัวเลขเรียบร้อยแล้ว
    const { os, difficulty, level, title, description, expectedCommand, hint, rewardExp } = c.req.valid('json')
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    const existingMission = await prisma.mission.findFirst({
      where: { os: os, level: level } // ไม่ต้องใช้ parseInt แล้ว!
    })

    if (existingMission) {
      return c.json({ success: false, message: `โจทย์หมวด ${os} Level ${level} มีอยู่แล้ว!` }, 400)
    }

    const newMission = await prisma.mission.create({
      data: {
        os, difficulty, level, title, description,
        expectedCommand, hint, rewardExp
      }
    })
    return c.json({ success: true, message: 'เพิ่มภารกิจใหม่สำเร็จ!', data: newMission }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหา' }, 500)
  }
})

// ==========================================
// 🔀 API: สลับ level ของโจทย์ 2 ข้อ (เนื้อหาไม่ขยับ แลกกันแค่เลขด่าน)
//
// ⚠️ schema มี @@unique([os, level]) → จะ UPDATE ตรงๆ สลับกันไม่ได้ เพราะจังหวะ
//    ที่ตัวแรกย้ายไปเลขของตัวที่สองจะชน constraint ทันที
//    จึงต้องพักตัวแรกไว้ที่ "เลขติดลบ" ก่อน (ด่านจริงเริ่มที่ 1 เลขลบจึงว่างเสมอ)
//    แล้วค่อยย้ายอีกตัวเข้ามา — ส่งเป็น $transaction เพื่อให้ทั้ง 3 สเต็ปสำเร็จหรือ
//    ล้มเหลวพร้อมกัน ไม่ปล่อยให้มีโจทย์ค้างอยู่ที่เลขติดลบ
// ==========================================
adminRoute.put('/missions/swap',
  zValidator('json', missionSwapSchema, (result, c) => {
    if (!result.success) return c.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', error: result.error.issues }, 400)
  }),
  async (c) => {
    try {
      const { idA, idB } = c.req.valid('json')
      if (idA === idB) return c.json({ success: false, message: 'เลือกโจทย์คนละข้อด้วย' }, 400)

      const adapter = new PrismaD1(c.env.DB)
      const prisma = new PrismaClient({ adapter })

      const [a, b] = await Promise.all([
        prisma.mission.findUnique({ where: { id: idA }, select: { id: true, os: true, level: true } }),
        prisma.mission.findUnique({ where: { id: idB }, select: { id: true, os: true, level: true } })
      ])

      if (!a || !b) return c.json({ success: false, message: 'ไม่พบโจทย์ที่เลือก' }, 404)
      // ข้าม OS ไม่ได้ เพราะเลขด่านของ linux/windows เป็นคนละชุดกัน สลับแล้วลำดับจะเพี้ยนทั้งสองฝั่ง
      if (a.os !== b.os) return c.json({ success: false, message: 'สลับข้าม OS ไม่ได้ ต้องเป็นหมวดเดียวกัน' }, 400)

      await prisma.$transaction([
        prisma.mission.update({ where: { id: a.id }, data: { level: -a.level } }), // พักไว้ที่เลขลบ
        prisma.mission.update({ where: { id: b.id }, data: { level: a.level } }),
        prisma.mission.update({ where: { id: a.id }, data: { level: b.level } })
      ])

      return c.json({ success: true, message: `สลับ Level ${a.level} ↔ ${b.level} สำเร็จ!` })
    } catch (error) {
      return c.json({ success: false, message: 'สลับโจทย์ไม่สำเร็จ' }, 500)
    }
  })

// ==========================================
// ↕️ API: เรียงลำดับโจทย์ใหม่ทั้งหมวด (ใช้กับการลากวาง)
//
// รับ id เรียงตามลำดับที่ต้องการ แล้วไล่เลขให้เป็น 1..N
// ⚠️ ติด @@unique([os, level]) เหมือนกัน → ต้องทำ 2 รอบ:
//    รอบแรกย้ายทุกข้อไปพักที่เลขลบ (เคลียร์เลข 1..N ให้ว่างทั้งแถว)
//    รอบสองค่อยวางเลขจริง — ถ้าทำรอบเดียวจะชนกับข้อที่ยังไม่ได้ขยับ
// ==========================================
adminRoute.put('/missions/reorder',
  zValidator('json', missionReorderSchema, (result, c) => {
    if (!result.success) return c.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', error: result.error.issues }, 400)
  }),
  async (c) => {
    try {
      const { os, orderedIds } = c.req.valid('json')
      const adapter = new PrismaD1(c.env.DB)
      const prisma = new PrismaClient({ adapter })

      const missions = await prisma.mission.findMany({ where: { os }, select: { id: true } })

      // ต้องส่งมาครบทั้งหมวด ไม่งั้นการไล่เลข 1..N จะไปทับข้อที่ไม่ได้ส่งมา
      const known = new Set(missions.map((m) => m.id))
      if (orderedIds.length !== missions.length || orderedIds.some((id) => !known.has(id))) {
        return c.json({ success: false, message: 'รายการโจทย์ไม่ตรงกับในระบบ กรุณารีเฟรชแล้วลองใหม่' }, 400)
      }
      if (new Set(orderedIds).size !== orderedIds.length) {
        return c.json({ success: false, message: 'มีโจทย์ซ้ำในรายการที่ส่งมา' }, 400)
      }

      await prisma.$transaction([
        // รอบ 1: พักทุกข้อไว้ที่เลขลบ เพื่อเคลียร์เลข 1..N ให้ว่าง
        ...orderedIds.map((id, i) =>
          prisma.mission.update({ where: { id }, data: { level: -(i + 1) } })
        ),
        // รอบ 2: วางเลขจริงตามลำดับใหม่
        ...orderedIds.map((id, i) =>
          prisma.mission.update({ where: { id }, data: { level: i + 1 } })
        )
      ])

      return c.json({ success: true, message: `เรียงลำดับโจทย์ ${os} ใหม่แล้ว (${orderedIds.length} ข้อ)` })
    } catch (error) {
      return c.json({ success: false, message: 'เรียงลำดับไม่สำเร็จ' }, 500)
    }
  })

// ==========================================
// 🚀 API: อัปเดต/แก้ไขโจทย์ [ติดเกราะ Zod]
// ==========================================
adminRoute.put('/missions/:id', 
  zValidator('json', missionUpdateSchema, (result, c) => {
    if (!result.success) return c.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', error: result.error.issues }, 400)
  }),
  async (c) => {
  try {
    const id = c.req.param('id')
    const { title, description, expectedCommand, hint } = c.req.valid('json')
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
// 🚀 API: กด Favorite โจทย์สำหรับ Admin [ติดเกราะ Zod]
// ==========================================
adminRoute.put('/favorites', 
  zValidator('json', favoriteSchema, (result, c) => {
    if (!result.success) return c.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', error: result.error.issues }, 400)
  }),
  async (c) => {
  try {
    const authUser = c.get('user')
    const { missionId } = c.req.valid('json')
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