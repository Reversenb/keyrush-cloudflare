import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'

type Bindings = { DB: D1Database }
const docsRoute = new Hono<{ Bindings: Bindings }>()

// ==========================================
// 📚 API: ดึงข้อมูล Docs ตามระบบปฏิบัติการ
// ==========================================
docsRoute.get('/:os', async (c) => {
  try {
    const os = c.req.param('os') // รับค่า 'linux' หรือ 'windows'
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    // ดึงคำสั่งทั้งหมดของ OS นั้น และจัดเรียงตามหมวดหมู่ตัวอักษร
    const docs = await prisma.commandDoc.findMany({
      where: { os: os },
      orderBy: [{ category: 'asc' }, { command: 'asc' }]
    })

    return c.json({ success: true, data: docs })
  } catch (error) {
    console.error("Docs Fetch Error:", error)
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหา' }, 500)
  }
})

export default docsRoute