import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'

type Bindings = { DB: D1Database }
const missionRoute = new Hono<{ Bindings: Bindings }>()

// ==========================================
// 🚀 API: ดึงโจทย์เฉพาะด่าน (เอาไว้เล่นเกม)
// ==========================================
missionRoute.get('/:os/:level', async (c) => {
  try {
    const targetOs = c.req.param('os')
    const targetLevel = parseInt(c.req.param('level'), 10)

    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    // ค้นหาด่านที่ตรงกับ OS และ Level ที่ส่งมา
    const mission = await prisma.mission.findFirst({
      where: { os: targetOs, level: targetLevel }
    })

    if (mission) {
      return c.json({ success: true, data: mission })
    } else {
      return c.json({ success: false, message: "ยังไม่ได้สร้างด่านนี้ครับบอส!" }, 404)
    }
  } catch (error) {
    console.error("Get Mission Error:", error)
    return c.json({ success: false, message: "เซิร์ฟเวอร์มีปัญหา" }, 500)
  }
})

export default missionRoute