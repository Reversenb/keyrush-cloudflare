import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'
import { z } from 'zod' // 🌟 1. Import Zod
import { zValidator } from '@hono/zod-validator' // 🌟 2. Import ตัวตรวจจับของ Hono

import { authenticateToken, authorizeAdmin } from '../middlewares/auth'

type Bindings = { DB: D1Database; JWT_SECRET: string }
const adminDocsRoute = new Hono<{ Bindings: Bindings }>()

adminDocsRoute.use('/*', authenticateToken, authorizeAdmin)

// ==========================================
// 🛡️ กฎ Zod สำหรับการสร้างและแก้ไข Docs
// ==========================================
const docCreateSchema = z.object({
  os: z.enum(['linux', 'windows'], { message: 'OS ต้องเป็น linux หรือ windows เท่านั้น' }),
  category: z.string().min(1, { message: 'ต้องระบุหมวดหมู่ (Category)' }),
  command: z.string().min(1, { message: 'ต้องระบุคำสั่ง (Command)' }),
  description: z.string().min(1, { message: 'ต้องระบุคำอธิบาย' }),
  example: z.string().optional().nullable() // เป็นค่าว่าง หรือ null ก็ได้
})

const docUpdateSchema = z.object({
  os: z.enum(['linux', 'windows'], { message: 'OS ต้องเป็น linux หรือ windows เท่านั้น' }).optional(),
  category: z.string().min(1, { message: 'ต้องระบุหมวดหมู่ (Category)' }).optional(),
  command: z.string().min(1, { message: 'ต้องระบุคำสั่ง (Command)' }).optional(),
  description: z.string().min(1, { message: 'ต้องระบุคำอธิบาย' }).optional(),
  example: z.string().optional().nullable()
})

// ==========================================
// ➕ API: สร้างข้อมูลคำสั่งใหม่ (Create) [ติดเกราะ Zod]
// ==========================================
adminDocsRoute.post('/', 
  zValidator('json', docCreateSchema, (result, c) => {
    if (!result.success) return c.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', error: result.error.issues }, 400)
  }),
  async (c) => {
  try {
    const body = c.req.valid('json') // 🌟 ดึงข้อมูลที่ผ่านการสแกนแล้ว
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    const doc = await prisma.commandDoc.create({
      data: {
        os: body.os,
        category: body.category,
        command: body.command,
        description: body.description,
        example: body.example || null
      }
    })
    
    return c.json({ success: true, data: doc }, 201)
  } catch (err: any) {
    console.error("Create Doc Error:", err)
    return c.json({ success: false, message: 'สร้างคำสั่งไม่สำเร็จ' }, 500)
  }
})

// ==========================================
// ✏️ API: แก้ไขข้อมูลคำสั่งเดิม (Update) [ติดเกราะ Zod]
// ==========================================
adminDocsRoute.put('/:id', 
  zValidator('json', docUpdateSchema, (result, c) => {
    if (!result.success) return c.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', error: result.error.issues }, 400)
  }),
  async (c) => {
  try {
    const id = c.req.param('id')
    const body = c.req.valid('json') // 🌟 ดึงข้อมูลที่ผ่านการสแกนแล้ว
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    const doc = await prisma.commandDoc.update({
      where: { id },
      data: {
        os: body.os,
        category: body.category,
        command: body.command,
        description: body.description,
        example: body.example || null
      }
    })
    
    return c.json({ success: true, data: doc })
  } catch (err: any) {
    console.error("Update Doc Error:", err)
    return c.json({ success: false, message: 'แก้ไขคำสั่งไม่สำเร็จ' }, 500)
  }
})

// ==========================================
// 🗑️ API: ลบข้อมูลคำสั่ง (Delete)
// ==========================================
adminDocsRoute.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    await prisma.commandDoc.delete({ where: { id } })
    
    return c.json({ success: true, message: 'ลบข้อมูลสำเร็จ' })
  } catch (err: any) {
    console.error("Delete Doc Error:", err)
    return c.json({ success: false, message: 'ลบคำสั่งไม่สำเร็จ' }, 500)
  }
})

export default adminDocsRoute