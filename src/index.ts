import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'

import userRoute from './routes/user'
import leaderboardRoute from './routes/leaderboard'
import authRoute from './routes/auth'
import missionRoute from './routes/mission'
import adminRoute from './routes/admin'
import docsRoute from './routes/docs'
import adminDocsRoute from './routes/adminDocs'
import seedRoute from './routes/seed' 

type Bindings = {
  DB: D1Database
  JWT_SECRET: string 
  SEED_PASSWORD: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

app.get('/', (c) => {
  return c.text('✅ KeyRush Serverless API (Hono) is ready! 🚀')
})

app.get('/api/mission/all', async (c) => {
  try {
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })
    const missions = await prisma.mission.findMany({
      orderBy: [{ os: 'asc' }, { level: 'asc' }]
    })
    return c.json({ success: true, data: missions })
  } catch (error) {
    console.error(error)
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหา' }, 500)
  }
})

// ========================================================
// 🚀 ลงทะเบียน Routes ทั้งหมดที่นี่
// ========================================================
app.route('/api/auth', authRoute)
app.route('/api/user', userRoute)
app.route('/api/leaderboard', leaderboardRoute)
app.route('/api/mission', missionRoute)
app.route('/api/admin', adminRoute)
app.route('/api/docs', docsRoute)
app.route('/api/admin/docs', adminDocsRoute)

app.route('/api/seed', seedRoute) 

export default app