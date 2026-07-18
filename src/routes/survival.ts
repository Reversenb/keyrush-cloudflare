import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { sign, verify } from 'hono/jwt'
import { authenticateToken } from '../middlewares/auth'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = {
  user: { userId: string; username: string; role: string; tokenVersion: number }
}
const survivalRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ==========================================
// 🎮 ค่าคงที่โหมด Survival (server-authoritative เต็มรูปแบบ)
// server เป็นคนนับข้อที่ตอบถูกเองทุกคำตอบผ่าน rolling token — client เคลมตัวเลขเองไม่ได้เลย
// ==========================================
const SURVIVAL_TTL_SEC = 60 * 30      // ตั๋วเกมอยู่ได้ 30 นาที (เกมจริงยาวสุดไม่กี่นาที)
const EXP_PER_CLEAR = 5               // พิมพ์ถูก 1 ข้อ = 5 EXP (ตรงกับที่ frontend โชว์) ไม่มีเพดานต่อเกม
const COINS_PER_CLEAR = 1             // 🪙 พิมพ์ถูก 1 ข้อ = 1 เหรียญ (ใช้ซื้อของในร้าน)
const MAX_HUMAN_WPM = 400             // เพดานความเร็วพิมพ์ของมนุษย์ เกินนี้ = บอท
const MEMORIZE_MS = 2000              // frontend บังคับเฟส "จำก่อนพิมพ์" ข้อละ 2 วิ
const BASE_DURATION_SEC = 60          // เวลาเริ่มต้นของเกม
const TIME_PER_CLEAR_SEC = 2          // ตอบถูก 1 ข้อ ต่อเวลาเพิ่ม 2 วิ
const SURVIVAL_HISTORY_LEVEL = 0      // ใช้ level 0 ใน PlayHistory เป็นตัวบอกว่าเป็นรอบ Survival
const nowSec = () => Math.floor(Date.now() / 1000)

// เวลาขั้นต่ำที่มนุษย์ใช้พิมพ์คำสั่งความยาวนี้ (ที่ความเร็วเพดาน 400 WPM)
const minTypeMs = (len: number) => (len / 5) / MAX_HUMAN_WPM * 60000

// 💰 เพดานเวลารวมของเกม ณ จุดที่ตอบถูกแล้ว C ข้อ:
// เฟสพิมพ์กินได้มากสุด 60 + 2C วิ (timer หมดเกมจบ) + เฟสจำ 2 วิต่อข้อ ≈ 60 + 4C (+ margin เผื่อ network)
const maxElapsedSec = (cleared: number, marginSec: number) =>
  BASE_DURATION_SEC + (TIME_PER_CLEAR_SEC + MEMORIZE_MS / 1000) * cleared + MEMORIZE_MS / 1000 + marginSec

// ==========================================
// 🎲 สุ่มลำดับโจทย์แบบ deterministic ด้วย seed
// server ฝัง seed ไว้ในตั๋ว → ทุก request คำนวณลำดับเดียวกันได้เป๊ะ โดยไม่ต้องเก็บ state
// ==========================================
const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const shuffleBySeed = <T,>(arr: T[], seed: number): T[] => {
  const a = [...arr]
  const rand = mulberry32(seed)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 📚 ดึงโจทย์จากตาราง Docs แล้วสลับตาม seed (ลำดับตรงกันทุกครั้งที่เรียกด้วย seed เดิม)
const loadQuestions = async (prisma: PrismaClient, os: string, seed: number) => {
  const docs = await prisma.commandDoc.findMany({
    where: { os },
    orderBy: { id: 'asc' },
    select: { id: true, command: true, description: true, example: true }
  })
  const questions = docs
    .map((d) => ({
      id: d.id,
      description: d.description,
      expectedCommand: (d.example?.trim() || d.command.trim())
    }))
    .filter((q) => q.expectedCommand.length > 0 && q.description.length > 0)
  return shuffleBySeed(questions, seed)
}

// สร้าง rolling token สถานะเกม — ทุกคำตอบที่ถูกจะได้ใบใหม่ที่นับแต้มเพิ่ม
type PlaySession = {
  purpose: 'survival-play'
  userId: string
  os: 'linux' | 'windows'
  seed: number
  startedAt: number   // วินาที
  lastAt: number      // มิลลิวินาที — เวลาของคำตอบล่าสุด (ใช้เช็คความเร็วต่อข้อ)
  cleared: number     // จำนวนข้อที่ server ยืนยันว่าถูกแล้ว
  attempts: number    // จำนวนครั้งที่ส่งคำตอบทั้งหมด (ใช้คุม accuracy)
  retry: boolean      // true = ข้อเดิมตอบผิดมาก่อน (รอบใหม่ไม่ต้องรอเฟสจำ 2 วิ)
  exp: number
}

const signSession = (session: PlaySession, secret: string) => sign(session as any, secret, 'HS256')

// ==========================================
// 🚀 API 1: เริ่มเกม — server สลับโจทย์เองด้วย seed + ออก rolling token (ต้อง login)
// GET /api/survival/start?os=linux|windows
// ==========================================
survivalRoute.get('/start', authenticateToken, async (c) => {
  try {
    const authUser = c.get('user')
    const os = c.req.query('os')
    if (os !== 'linux' && os !== 'windows') {
      return c.json({ success: false, message: 'ระบบปฏิบัติการไม่ถูกต้อง' }, 400)
    }

    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    const seed = Math.floor(Math.random() * 2147483647)
    const questions = await loadQuestions(prisma, os, seed)

    if (questions.length === 0) {
      return c.json({ success: false, message: 'ไม่พบข้อมูลคำสั่งในระบบ' }, 404)
    }

    const session: PlaySession = {
      purpose: 'survival-play',
      userId: authUser.userId,
      os,
      seed,
      startedAt: nowSec(),
      lastAt: Date.now(),
      cleared: 0,
      attempts: 0,
      retry: false,
      exp: nowSec() + SURVIVAL_TTL_SEC
    }
    const token = await signSession(session, c.env.JWT_SECRET)

    // ⚠️ client ต้องเล่นตามลำดับนี้เป๊ะ (ห้ามสลับเอง) เพราะ server เช็คคำตอบตามลำดับเดียวกัน
    return c.json({ success: true, data: questions, token })
  } catch (error) {
    console.error('Survival Start Error:', error)
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหาตอนเริ่มเกม' }, 500)
  }
})

// ==========================================
// 🛡️ กฎ Zod สำหรับการส่งคำตอบรายข้อ
// ==========================================
const answerSchema = z.object({
  token: z.string().min(1),
  answer: z.string().min(1).max(300)
})

// ==========================================
// 🎯 API 2: ตอบรายข้อ — server ตรวจคำตอบ นับแต้มเอง และออกตั๋วใบใหม่
// POST /api/survival/answer  body: { token, answer }
// ==========================================
survivalRoute.post('/answer',
  authenticateToken,
  zValidator('json', answerSchema, (result, c) => {
    if (!result.success) return c.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' }, 400)
  }),
  async (c) => {
    try {
      const authUser = c.get('user')
      const { token, answer } = c.req.valid('json')

      let session: PlaySession
      try {
        session = await verify(token, c.env.JWT_SECRET, 'HS256') as unknown as PlaySession
      } catch {
        return c.json({ success: false, message: 'เซสชันเกมหมดอายุ กรุณาเริ่มเกมใหม่' }, 400)
      }
      if (session.purpose !== 'survival-play' || session.userId !== authUser.userId) {
        return c.json({ success: false, message: 'เซสชันเกมไม่ถูกต้อง' }, 403)
      }

      const adapter = new PrismaD1(c.env.DB)
      const prisma = new PrismaClient({ adapter })

      const questions = await loadQuestions(prisma, session.os, Number(session.seed))
      if (questions.length === 0) {
        return c.json({ success: false, message: 'ไม่พบข้อมูลคำสั่งในระบบ' }, 404)
      }

      const cleared = Number(session.cleared) || 0
      const attempts = Number(session.attempts) || 0
      const current = questions[cleared % questions.length]
      const isCorrect = answer.trim() === current.expectedCommand

      const now = Date.now()
      let nextSession: PlaySession

      if (isCorrect) {
        // 🤖 กันบอท: ข้อนี้ต้องใช้เวลาอย่างน้อย = เฟสจำ (ถ้าเป็นรอบแรกของข้อ) + เวลาพิมพ์ที่เพดานมนุษย์
        const requiredMs = minTypeMs(current.expectedCommand.length) + (session.retry ? 0 : MEMORIZE_MS)
        if (now - Number(session.lastAt) < requiredMs) {
          return c.json({ success: false, message: 'ตรวจพบการเล่นที่เร็วผิดปกติ' }, 403)
        }
        // ⏳ กันลากเกมยาวเกินจริง: เวลารวมต้องไม่เกินที่เกมจริงเป็นไปได้ ณ จำนวนข้อนี้
        const elapsedSec = now / 1000 - Number(session.startedAt)
        if (elapsedSec > maxElapsedSec(cleared, 45)) {
          return c.json({ success: false, message: 'เซสชันเกมเกินเวลาที่เป็นไปได้ กรุณาเริ่มใหม่' }, 403)
        }
        nextSession = { ...session, cleared: cleared + 1, attempts: attempts + 1, retry: false, lastAt: now }
      } else {
        // ตอบผิด: จดจำนวนครั้ง + ธงว่าข้อเดิมกำลังพิมพ์ใหม่ (ไม่มีเฟสจำรอบสอง)
        nextSession = { ...session, attempts: attempts + 1, retry: true, lastAt: now }
      }

      const newToken = await signSession(nextSession, c.env.JWT_SECRET)
      return c.json({ success: true, isCorrect, token: newToken })
    } catch (error) {
      console.error('Survival Answer Error:', error)
      return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหาตอนตรวจคำตอบ' }, 500)
    }
  })

// ==========================================
// 🛡️ กฎ Zod สำหรับการปิดเกม
// ==========================================
const submitSchema = z.object({
  token: z.string().min(1),
  maxCombo: z.coerce.number().int().min(0).max(10000),
  // สถิติจาก keystroke ฝั่ง client — ใช้เป็นตัวเลขโชว์ แต่โดน clamp ด้วยค่าที่ server คำนวณเอง
  wpm: z.coerce.number().int().min(0).max(MAX_HUMAN_WPM).optional(),
  accuracy: z.coerce.number().int().min(0).max(100).optional()
})

// ==========================================
// 🏁 API 3: จบเกม — EXP คิดจากแต้มที่ server นับเองใน token เท่านั้น
// POST /api/survival/submit  body: { token, maxCombo, wpm?, accuracy? }
// ==========================================
survivalRoute.post('/submit',
  authenticateToken,
  zValidator('json', submitSchema, (result, c) => {
    if (!result.success) return c.json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' }, 400)
  }),
  async (c) => {
    try {
      const authUser = c.get('user')
      const { token, maxCombo, wpm, accuracy } = c.req.valid('json')

      let session: PlaySession
      try {
        session = await verify(token, c.env.JWT_SECRET, 'HS256') as unknown as PlaySession
      } catch {
        return c.json({ success: false, message: 'เซสชันเกมหมดอายุ กรุณาเริ่มเกมใหม่' }, 400)
      }
      if (session.purpose !== 'survival-play' || session.userId !== authUser.userId) {
        return c.json({ success: false, message: 'เซสชันเกมไม่ถูกต้อง' }, 403)
      }

      const os = session.os
      const startedAt = Number(session.startedAt)
      // 🔢 จำนวนข้อที่ถูก มาจากตั๋วที่ server นับเองเท่านั้น — client ไม่มีสิทธิ์เคลม
      const cleared = Number(session.cleared) || 0
      const attempts = Number(session.attempts) || 0

      // 🤝 คอมโบสูงสุดเกินจำนวนข้อที่ถูกไม่ได้
      if (maxCombo > cleared) {
        return c.json({ success: false, message: 'ตรวจพบข้อมูลคะแนนผิดปกติ' }, 403)
      }

      // ⏳ เวลารวมของเกมต้องไม่เกินที่เป็นไปได้ (กันดองตั๋วไว้ส่งทีหลัง)
      const elapsedSec = Date.now() / 1000 - startedAt
      if (elapsedSec > maxElapsedSec(cleared, 90)) {
        return c.json({ success: false, message: 'เซสชันเกมเกินเวลาที่เป็นไปได้ กรุณาเริ่มใหม่' }, 403)
      }

      const adapter = new PrismaD1(c.env.DB)
      const prisma = new PrismaClient({ adapter })

      // 🔁 กันใช้ตั๋วซ้ำ (replay): มีประวัติ Survival หลังเวลาเริ่มของตั๋วนี้ = ตั๋วถูกใช้แล้ว
      const alreadySubmitted = await prisma.playHistory.findFirst({
        where: {
          userId: authUser.userId,
          level: SURVIVAL_HISTORY_LEVEL,
          createdAt: { gte: new Date(startedAt * 1000) }
        },
        select: { id: true }
      })
      if (alreadySubmitted) {
        return c.json({ success: false, message: 'คะแนนรอบนี้ถูกบันทึกไปแล้ว' }, 409)
      }

      // 🧮 EXP + เหรียญ ฝั่ง server เท่านั้น — คิดจากแต้มที่ server นับเอง
      const earnedExp = cleared * EXP_PER_CLEAR
      const earnedCoins = cleared * COINS_PER_CLEAR

      // 📊 สถิติ: server รู้ว่าข้อที่ผ่านคือคำสั่งไหนบ้าง → คำนวณเพดาน WPM เองได้
      const questions = await loadQuestions(prisma, os, Number(session.seed))
      let correctChars = 0
      if (questions.length > 0) {
        for (let k = 0; k < cleared; k++) {
          correctChars += questions[k % questions.length].expectedCommand.length
        }
      }
      // เวลาเฟสพิมพ์ ≈ เวลารวม - เฟสจำ 2 วิต่อข้อ
      const typeSeconds = Math.max(1, elapsedSec - (MEMORIZE_MS / 1000) * (cleared + 1))
      const serverWpm = cleared > 0 ? (correctChars / 5) / (typeSeconds / 60) : 0
      // ใช้ค่าที่ client วัดจริง แต่ห้ามเกินเพดานที่ server คำนวณ (+25% เผื่อความคลาดเคลื่อนของเวลา)
      const finalWpm = Math.min(
        wpm ?? Math.round(serverWpm),
        Math.ceil(serverWpm * 1.25),
        MAX_HUMAN_WPM
      )
      // ความแม่นยำระดับคำตอบที่ server นับเอง เป็นเพดานของค่าที่ client รายงาน
      const serverAccuracy = attempts > 0 ? Math.round((cleared / attempts) * 100) : 0
      const finalAccuracy = Math.min(accuracy ?? serverAccuracy, serverAccuracy)

      // 💾 เพิ่ม EXP ให้ OS ที่เล่น (Survival ไม่ปลดล็อกเลเวลด่าน)
      const currentUser = await prisma.user.findUnique({
        where: { id: authUser.userId },
        select: { linuxExp: true, windowsExp: true }
      })
      if (!currentUser) return c.json({ success: false, message: 'ไม่พบผู้ใช้' }, 404)

      if (earnedExp > 0) {
        await prisma.user.update({
          where: { id: authUser.userId },
          data: os === 'windows'
            ? { windowsExp: currentUser.windowsExp + earnedExp, coins: { increment: earnedCoins } }
            : { linuxExp: currentUser.linuxExp + earnedExp, coins: { increment: earnedCoins } }
        })
      }

      // 📜 บันทึกลง PlayHistory → โชว์ในหน้า History อัตโนมัติ (level 0 = Survival)
      await prisma.playHistory.create({
        data: {
          userId: authUser.userId,
          os,
          level: SURVIVAL_HISTORY_LEVEL,
          wpm: finalWpm,
          accuracy: finalAccuracy,
          earnedExp
        }
      })

      return c.json({
        success: true,
        message: earnedExp > 0 ? 'บันทึกคะแนนสำเร็จ!' : 'บันทึกรอบเล่นสำเร็จ (ไม่ได้รับ EXP)',
        earnedExp,
        earnedCoins,
        clearedCount: cleared,
        // ค่าที่บันทึกลง History จริง — ให้ frontend โชว์ชุดเดียวกันจะได้ตรงกันทุกหน้า
        wpm: finalWpm,
        accuracy: finalAccuracy
      })
    } catch (error) {
      console.error('Survival Submit Error:', error)
      return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหาตอนบันทึกคะแนน' }, 500)
    }
  })

export default survivalRoute
