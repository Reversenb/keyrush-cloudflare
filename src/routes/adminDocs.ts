import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'

type Bindings = { DB: D1Database }
const adminDocsRoute = new Hono<{ Bindings: Bindings }>()

// ==========================================
// ➕ API: สร้างข้อมูลคำสั่งใหม่ (Create)
// ==========================================
adminDocsRoute.post('/', async (c) => {
  try {
    const body = await c.req.json()
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
    
    return c.json({ success: true, data: doc })
  } catch (err: any) {
    console.error("Create Doc Error:", err)
    return c.json({ success: false, message: 'สร้างคำสั่งไม่สำเร็จ' }, 500)
  }
})

// ==========================================
// ✏️ API: แก้ไขข้อมูลคำสั่งเดิม (Update)
// ==========================================
adminDocsRoute.put('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
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