import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'
import { findItem } from '../shop/items'

// 🌟 ผูก Type ให้ TypeScript รู้จักตัวแปร DB
type Bindings = { DB: D1Database }
const leaderboardRoute = new Hono<{ Bindings: Bindings }>()

// ==========================================
// 🏆 API: ดึงข้อมูลจัดอันดับ 50 อันดับแรก
// ==========================================
leaderboardRoute.get('/:os', async (c) => {
  try {
    const os = c.req.param('os') // รับค่าเป็น 'linux', 'windows' หรือ 'combined'
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    let topUsers;

    // 🪟 บอร์ดจัดอันดับ Windows (ดึงเฉพาะคนที่มี exp > 0)
    if (os === 'windows') {
      topUsers = await prisma.user.findMany({
        where: { windowsExp: { gt: 0 } }, 
        orderBy: { windowsExp: 'desc' }, 
        take: 50,
        select: { id: true, username: true, displayName: true, avatar: true, equippedTitle: true, equippedFrame: true, equippedRow: true, windowsLevel: true, windowsExp: true }
      })
    } 
    // 🌍 บอร์ดจัดอันดับรวม (เอาคะแนน Linux + Windows มาบวกกัน)
    else if (os === 'combined') {
      const allUsers = await prisma.user.findMany({
        where: { OR: [{ linuxExp: { gt: 0 } }, { windowsExp: { gt: 0 } }] },
        select: { id: true, username: true, displayName: true, avatar: true, equippedTitle: true, equippedFrame: true, equippedRow: true, linuxLevel: true, linuxExp: true, windowsLevel: true, windowsExp: true }
      })
      // เรียงลำดับด้วย JavaScript (เพราะรวม 2 คอลัมน์)
      topUsers = allUsers
        .sort((a, b) => ((b.linuxExp || 0) + (b.windowsExp || 0)) - ((a.linuxExp || 0) + (a.windowsExp || 0)))
        .slice(0, 50)
    } 
    // 🐧 บอร์ดจัดอันดับ Linux (ค่าเริ่มต้น)
    else {
      topUsers = await prisma.user.findMany({
        where: { linuxExp: { gt: 0 } }, 
        orderBy: { linuxExp: 'desc' }, 
        take: 50,
        select: { id: true, username: true, displayName: true, avatar: true, equippedTitle: true, equippedFrame: true, equippedRow: true, linuxLevel: true, linuxExp: true }
      })
    }

    // ??? ???? itemId ??????? ? ???????????????? (????????????????? server ????????)
    const withTitles = topUsers.map((u: any) => ({
      ...u,
      title: u.equippedTitle ? (findItem(u.equippedTitle)?.label ?? null) : null,
      // กรอบรูปที่ใส่อยู่ → ส่ง frameId ให้หน้าเว็บเอาไปทำคลาส .kr-frame-*
      frame: u.equippedFrame ? (findItem(u.equippedFrame)?.frameId ?? null) : null,
      // เอฟเฟกต์แถวที่ใส่อยู่ → ส่ง rowId ให้หน้าเว็บทำคลาส .kr-row-*
      rowEffect: u.equippedRow ? (findItem(u.equippedRow)?.rowId ?? null) : null
    }))

    return c.json({ success: true, data: withTitles })

  } catch (error) {
    console.error("Leaderboard Error:", error)
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหาในการดึงข้อมูลจัดอันดับ' }, 500)
  }
})

export default leaderboardRoute
