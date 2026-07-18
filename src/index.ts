import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers' 
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'

import userRoute from './routes/user'
import leaderboardRoute from './routes/leaderboard'
import authRoute from './routes/auth'
import missionRoute from './routes/mission'
import adminRoute from './routes/admin'
import docsRoute from './routes/docs'
import survivalRoute from './routes/survival'
import shopRoute from './routes/shop'
import adminDocsRoute from './routes/adminDocs'
import seedRoute from './routes/seed' 
import { rateLimiter } from './middlewares/rateLimit'
import { csrfProtection } from './middlewares/csrf'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string 
  SEED_PASSWORD: string
}

const app = new Hono<{ Bindings: Bindings }>()
// ========================================================
// 🛡️ CORE SECURITY LAYER
// ========================================================


app.use('/api/*', cors({
  origin: [
    'http://localhost:3000', 
    'https://keyrush-swart.vercel.app',   
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true,
}))

// 🌟 2. ด่านสอง: ใส่เกราะ HTTP Headers (จะได้มีเกราะติดไปกับทุก Response)
app.use('*', secureHeaders())
app.use('*', async (c, next) => {
  c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';")
  c.header('Permissions-Policy', "camera=(), microphone=(), geolocation=(), browsing-topics=()")
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  await next()
})

// 🌟 3. ด่านสาม: ตรวจจับสแปม (Rate Limiter) ค่อยทำงานหลังจากใส่ CORS เสร็จแล้ว
app.use('/api/*', rateLimiter)

// 🌟 4. ด่านสี่: CSRF (double-submit cookie) สำหรับ POST/PUT/DELETE ที่ใช้ cookie auth
app.use('/api/*', csrfProtection)

// ========================================================

app.get('/', (c) => {
  return c.text('✅ KeyRush Serverless API (Hono) is ready! 🚀')
})

app.get('/api/mission/all', async (c) => {
  try {
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })
    const missions = await prisma.mission.findMany({
      orderBy: [{ os: 'asc' }, { level: 'asc' }],
      select: {
        id: true,
        os: true,
        difficulty: true,
        level: true,
        title: true,
        description: true,
        rewardExp: true
        
      }
    })
    return c.json({ success: true, data: missions })
  } catch (error) {
    console.error(error)
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหา' }, 500)
  }
})

// 🚀 Routes ทั้งหมด
app.route('/api/auth', authRoute)
app.route('/api/user', userRoute)
app.route('/api/leaderboard', leaderboardRoute)
app.route('/api/mission', missionRoute)
app.route('/api/admin', adminRoute)
app.route('/api/docs', docsRoute)
app.route('/api/survival', survivalRoute)
app.route('/api/shop', shopRoute)
app.route('/api/admin/docs', adminDocsRoute)

app.route('/api/seed', seedRoute) 

export default app