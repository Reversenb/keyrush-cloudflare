import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { authenticateToken } from '../middlewares/auth'
import { SHOP_ITEMS, findItem } from '../shop/items'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = {
  user: { userId: string; username: string; role: string; tokenVersion: number }
}
const shopRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ทุก endpoint ของร้านต้อง login
shopRoute.use('/*', authenticateToken)

// ==========================================
// 🛍️ API 1: ดูของในร้าน + เหรียญ + ของที่มี/ใส่อยู่
// ==========================================
shopRoute.get('/', async (c) => {
  try {
    const authUser = c.get('user')
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    const [user, owned] = await Promise.all([
      prisma.user.findUnique({
        where: { id: authUser.userId },
        select: { coins: true, equippedTitle: true, equippedTheme: true, equippedCursor: true }
      }),
      prisma.userItem.findMany({
        where: { userId: authUser.userId },
        select: { itemId: true }
      })
    ])

    if (!user) return c.json({ success: false, message: 'ไม่พบผู้ใช้' }, 404)

    return c.json({
      success: true,
      data: {
        items: SHOP_ITEMS,
        ownedIds: owned.map((o) => o.itemId),
        coins: user.coins,
        equippedTitle: user.equippedTitle,
        equippedTheme: user.equippedTheme,
        equippedCursor: user.equippedCursor
      }
    })
  } catch (error) {
    console.error('Shop List Error:', error)
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหาตอนโหลดร้านค้า' }, 500)
  }
})

const idSchema = z.object({ itemId: z.string().min(1).max(64) })

// ==========================================
// 💰 API 2: ซื้อของ — หักเหรียญฝั่ง server (ราคาอ่านจากแคตตาล็อก ไม่รับจาก client)
// ==========================================
shopRoute.post('/buy',
  zValidator('json', idSchema, (result, c) => {
    if (!result.success) return c.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' }, 400)
  }),
  async (c) => {
    try {
      const authUser = c.get('user')
      const { itemId } = c.req.valid('json')

      const item = findItem(itemId)
      if (!item) return c.json({ success: false, message: 'ไม่พบสินค้านี้' }, 404)

      const adapter = new PrismaD1(c.env.DB)
      const prisma = new PrismaClient({ adapter })

      const user = await prisma.user.findUnique({
        where: { id: authUser.userId },
        select: { coins: true }
      })
      if (!user) return c.json({ success: false, message: 'ไม่พบผู้ใช้' }, 404)

      // กันซื้อซ้ำ (มี unique index กันอีกชั้นที่ระดับ DB)
      const already = await prisma.userItem.findUnique({
        where: { userId_itemId: { userId: authUser.userId, itemId } },
        select: { id: true }
      })
      if (already) return c.json({ success: false, message: 'คุณมีของชิ้นนี้อยู่แล้ว' }, 409)

      if (user.coins < item.price) {
        return c.json({ success: false, message: 'เหรียญไม่พอ' }, 400)
      }

      // หักเหรียญ + บันทึกของ (unique index กันกดรัวซื้อซ้ำ)
      await prisma.userItem.create({ data: { userId: authUser.userId, itemId } })
      const updated = await prisma.user.update({
        where: { id: authUser.userId },
        data: { coins: user.coins - item.price },
        select: { coins: true }
      })

      return c.json({ success: true, message: `ซื้อ "${item.name}" สำเร็จ!`, coins: updated.coins })
    } catch (error) {
      console.error('Shop Buy Error:', error)
      return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหาตอนซื้อของ' }, 500)
    }
  })

// ==========================================
// 👕 API 3: ใส่/ถอดของ — ส่ง itemId ว่างเพื่อถอด
// ==========================================
const equipSchema = z.object({ itemId: z.string().max(64) })

shopRoute.post('/equip',
  zValidator('json', equipSchema, (result, c) => {
    if (!result.success) return c.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' }, 400)
  }),
  async (c) => {
    try {
      const authUser = c.get('user')
      const { itemId } = c.req.valid('json')

      const adapter = new PrismaD1(c.env.DB)
      const prisma = new PrismaClient({ adapter })

      // ถอดของ: ส่ง itemId ว่าง + ต้องบอกประเภทผ่าน query (?type=title|terminal)
      if (!itemId) {
        const type = c.req.query('type')
        if (type !== 'title' && type !== 'theme' && type !== 'cursor') {
          return c.json({ success: false, message: 'ต้องระบุประเภทที่จะถอด' }, 400)
        }
        await prisma.user.update({
          where: { id: authUser.userId },
          data: type === 'title' ? { equippedTitle: null } : type === 'theme' ? { equippedTheme: null } : { equippedCursor: null }
        })
        return c.json({ success: true, message: 'ถอดItemสำเร็จ' })
      }

      const item = findItem(itemId)
      if (!item) return c.json({ success: false, message: 'ไม่พบสินค้านี้' }, 404)

      // ต้องเป็นเจ้าของก่อนถึงใส่ได้
      const owned = await prisma.userItem.findUnique({
        where: { userId_itemId: { userId: authUser.userId, itemId } },
        select: { id: true }
      })
      if (!owned) return c.json({ success: false, message: 'คุณยังไม่มีของชิ้นนี้' }, 403)

      await prisma.user.update({
        where: { id: authUser.userId },
        data: item.type === 'title' ? { equippedTitle: itemId } : item.type === 'theme' ? { equippedTheme: itemId } : { equippedCursor: itemId }
      })

      return c.json({ success: true, message: `ใส่ "${item.name}" แล้ว` })
    } catch (error) {
      console.error('Shop Equip Error:', error)
      return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหาตอนใส่ของ' }, 500)
    }
  })

export default shopRoute
