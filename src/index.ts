import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'
import userRoute from './routes/user'
import leaderboardRoute from './routes/leaderboard'
// 🌟 Import Routes ที่เราแยกไฟล์เอาไว้
import authRoute from './routes/auth'
import missionRoute from './routes/mission'
import adminRoute from './routes/admin'

// 🌟 ผูกตัวแปร "DB" และ "JWT_SECRET" จาก wrangler.json
type Bindings = {
  DB: D1Database
  JWT_SECRET: string 
}

const app = new Hono<{ Bindings: Bindings }>()

// 🌟 เปิด CORS ให้เว็บฝั่ง Next.js ยิง API เข้ามาได้
app.use('/api/*', cors())

// ==========================================
// 🚀 API 1: หน้าแรก เอาไว้เทสว่าระบบทำงานไหม
// ==========================================
app.get('/', (c) => {
  return c.text('✅ KeyRush Serverless API (Hono) is ready! 🚀')
})

// ==========================================
// 🚀 API 2: ดึงข้อมูลด่านทั้งหมด 
// ==========================================
app.get('/api/mission/all', async (c) => {
  try {
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    // ดึงข้อมูล Missions เรียงตาม OS และ Level
    const missions = await prisma.mission.findMany({
      orderBy: [{ os: 'asc' }, { level: 'asc' }]
    })

    return c.json({ success: true, data: missions })
  } catch (error) {
    console.error(error)
    return c.json({ success: false, message: 'เซิร์ฟเวอร์มีปัญหา' }, 500)
  }
})

// ==========================================
// 🌱 API 3: ใช้ยัดข้อมูลลง Database (Seed)
// ==========================================
app.get('/api/seed', async (c) => {
  try {
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    // 1. ล้างข้อมูลเก่าออกก่อน
    await prisma.mission.deleteMany({})

    // 2. ข้อมูลด่านทั้งหมด 34 ด่านของ KeyRush
    const missionsData = [
      { os: 'linux', difficulty: 'basic', level: 1, title: 'Print Working Directory', description: 'ดูพาธ (Path) ของโฟลเดอร์ปัจจุบันที่กำลังทำงานอยู่', expectedCommand: 'pwd', hint: 'พิมพ์คำสั่ง 3 ตัวอักษรที่ย่อมาจาก print working directory', rewardExp: 100 },
      { os: 'linux', difficulty: 'basic', level: 2, title: 'List Directory Contents', description: 'แสดงรายชื่อไฟล์และโฟลเดอร์ในไดเรกทอรีปัจจุบัน', expectedCommand: 'ls', hint: 'ย่อมาจากคำว่า list', rewardExp: 100 },
      { os: 'linux', difficulty: 'basic', level: 3, title: 'Change Directory', description: 'เปลี่ยนเข้าไปในโฟลเดอร์ชื่อ documents', expectedCommand: 'cd documents', hint: 'ใช้คำสั่ง cd ตามด้วยชื่อโฟลเดอร์', rewardExp: 100 },
      { os: 'linux', difficulty: 'basic', level: 4, title: 'Go Back Directory', description: 'ถอยกลับออกมา 1 โฟลเดอร์', expectedCommand: 'cd ..', hint: 'ใช้จุดสองจุด (..) เพื่อถอยกลับ', rewardExp: 100 },
      { os: 'linux', difficulty: 'basic', level: 5, title: 'Make Directory', description: 'สร้างโฟลเดอร์ใหม่ชื่อ project', expectedCommand: 'mkdir project', hint: 'ย่อมาจาก make directory', rewardExp: 100 },
      { os: 'linux', difficulty: 'basic', level: 6, title: 'Create Empty File', description: 'สร้างไฟล์เปล่าใหม่ขึ้นมาชื่อ index.html', expectedCommand: 'touch index.html', hint: 'ใช้คำสั่งแตะ (touch)', rewardExp: 100 },
      { os: 'linux', difficulty: 'basic', level: 7, title: 'Remove File', description: 'ลบไฟล์ที่ชื่อ old_file.txt ทิ้ง', expectedCommand: 'rm old_file.txt', hint: 'ย่อมาจาก remove', rewardExp: 100 },
      { os: 'linux', difficulty: 'basic', level: 8, title: 'Copy File', description: 'คัดลอกไฟล์จาก src ไปยัง dest', expectedCommand: 'cp src dest', hint: 'ย่อมาจาก copy', rewardExp: 100 },
      { os: 'linux', difficulty: 'basic', level: 9, title: 'Move or Rename File', description: 'เปลี่ยนชื่อไฟล์จาก old.txt เป็น new.txt', expectedCommand: 'mv old.txt new.txt', hint: 'ย่อมาจาก move', rewardExp: 100 },
      { os: 'linux', difficulty: 'basic', level: 10, title: 'Read File Content', description: 'อ่านและแสดงเนื้อหาในไฟล์ log.txt ออกมาบนหน้าจอ', expectedCommand: 'cat log.txt', hint: 'ใช้คำสั่งที่ชื่อเหมือนแมว', rewardExp: 100 },
      { os: 'linux', difficulty: 'basic', level: 11, title: 'Clear Terminal', description: 'ล้างหน้าจอ Terminal ให้สะอาด', expectedCommand: 'clear', hint: 'พิมพ์ตรงตัวเลย', rewardExp: 100 },
      { os: 'linux', difficulty: 'intermediate', level: 12, title: 'Global Regular Expression Print', description: 'ค้นหาคำว่า "error" ในไฟล์ server.log', expectedCommand: 'grep "error" server.log', hint: 'รูปแบบคือ grep "คำค้นหา" ชื่อไฟล์', rewardExp: 200 },
      { os: 'linux', difficulty: 'intermediate', level: 13, title: 'Find Files', description: 'ค้นหาตำแหน่งของไฟล์ชื่อ "config" เริ่มจาก Root (/)', expectedCommand: 'find / -name "config"', hint: 'ใช้ -name เพื่อระบุชื่อไฟล์', rewardExp: 200 },
      { os: 'linux', difficulty: 'intermediate', level: 14, title: 'Change Mode (Permissions)', description: 'เปลี่ยนสิทธิ์การเข้าถึงไฟล์ script.sh ให้เป็น 777', expectedCommand: 'chmod 777 script.sh', hint: 'ย่อมาจาก change mode', rewardExp: 200 },
      { os: 'linux', difficulty: 'intermediate', level: 15, title: 'Change Owner', description: 'เปลี่ยนเจ้าของไฟล์ app.js ให้เป็นผู้ใช้ชื่อ root', expectedCommand: 'chown root app.js', hint: 'ย่อมาจาก change owner', rewardExp: 200 },
      { os: 'linux', difficulty: 'intermediate', level: 16, title: 'Archive Files (Tarball)', description: 'บีบอัดโฟลเดอร์ data เป็นไฟล์ backup.tar.gz', expectedCommand: 'tar -czvf backup.tar.gz data', hint: 'ใช้แฟล็ก -czvf สำหรับสร้างไฟล์บีบอัด', rewardExp: 200 },
      { os: 'linux', difficulty: 'intermediate', level: 17, title: 'Nano Text Editor', description: 'เปิดโปรแกรมแก้ไขข้อความ (Text Editor) แบบง่ายในไฟล์ config.json', expectedCommand: 'nano config.json', hint: 'ใช้คำสั่ง nano นำหน้า', rewardExp: 200 },
      { os: 'linux', difficulty: 'intermediate', level: 18, title: 'System Monitor (htop)', description: 'ดูการทำงานของ CPU, RAM แบบเรียลไทม์', expectedCommand: 'htop', hint: 'พิมพ์ตรงตัวเลย', rewardExp: 200 },
      { os: 'linux', difficulty: 'intermediate', level: 19, title: 'Process Status', description: 'แสดงรายการโปรเซสทั้งหมดที่กำลังทำงานด้วยคำสั่ง ps aux', expectedCommand: 'ps aux', hint: 'ต้องมีเว้นวรรคระหว่าง ps กับ aux', rewardExp: 200 },
      { os: 'linux', difficulty: 'intermediate', level: 20, title: 'Kill Process', description: 'บังคับปิดโปรเซสที่มีรหัส PID เป็น 1234', expectedCommand: 'kill 1234', hint: 'ใช้คำสั่ง kill ตามด้วยหมายเลข PID', rewardExp: 200 },
      { os: 'linux', difficulty: 'intermediate', level: 21, title: 'Web Get (Download)', description: 'ดาวน์โหลดไฟล์จาก http://domain.com/file', expectedCommand: 'wget http://domain.com/file', hint: 'ย่อมาจาก web get', rewardExp: 200 },
      { os: 'linux', difficulty: 'intermediate', level: 22, title: 'Command History', description: 'ดูประวัติคำสั่งทั้งหมดที่เคยพิมพ์ไปก่อนหน้านี้', expectedCommand: 'history', hint: 'พิมพ์ตรงตัวเลย', rewardExp: 200 },
      { os: 'windows', difficulty: 'basic', level: 1, title: 'Directory Content', description: 'แสดงรายชื่อไฟล์และโฟลเดอร์ (เทียบเท่า ls ใน Linux)', expectedCommand: 'dir', hint: 'ย่อมาจาก directory', rewardExp: 100 },
      { os: 'windows', difficulty: 'basic', level: 2, title: 'Change Directory (Windows)', description: 'เปลี่ยนเข้าไปในโฟลเดอร์ชื่อ Documents', expectedCommand: 'cd Documents', hint: 'ใช้ cd เหมือนใน Linux', rewardExp: 100 },
      { os: 'windows', difficulty: 'basic', level: 3, title: 'Make Directory (Windows)', description: 'สร้างโฟลเดอร์ใหม่ชื่อ NewFolder', expectedCommand: 'md NewFolder', hint: 'ย่อมาจาก make directory (ใช้ md)', rewardExp: 100 },
      { os: 'windows', difficulty: 'basic', level: 4, title: 'Remove Directory', description: 'ลบโฟลเดอร์ชื่อ OldFolder ทิ้ง', expectedCommand: 'rd OldFolder', hint: 'ย่อมาจาก remove directory (ใช้ rd)', rewardExp: 100 },
      { os: 'windows', difficulty: 'basic', level: 5, title: 'Delete File', description: 'ลบไฟล์ที่ชื่อ junk.txt', expectedCommand: 'del junk.txt', hint: 'ย่อมาจาก delete', rewardExp: 100 },
      { os: 'windows', difficulty: 'basic', level: 6, title: 'Copy File (Windows)', description: 'คัดลอกไฟล์จาก a.txt ไปยัง b.txt', expectedCommand: 'copy a.txt b.txt', hint: 'พิมพ์ตรงตัวเลย', rewardExp: 100 },
      { os: 'windows', difficulty: 'basic', level: 7, title: 'Move File (Windows)', description: 'ย้ายไฟล์จาก a.txt ไปยัง b.txt', expectedCommand: 'move a.txt b.txt', hint: 'พิมพ์ตรงตัวเลย', rewardExp: 100 },
      { os: 'windows', difficulty: 'basic', level: 8, title: 'Type File Content', description: 'แสดงเนื้อหาในไฟล์ readme.txt (เทียบเท่า cat ใน Linux)', expectedCommand: 'type readme.txt', hint: 'ใช้คำสั่ง type', rewardExp: 100 },
      { os: 'windows', difficulty: 'basic', level: 9, title: 'Clear Screen', description: 'ล้างหน้าจอ CMD ให้สะอาด (เทียบเท่า clear ใน Linux)', expectedCommand: 'cls', hint: 'ย่อมาจาก clear screen', rewardExp: 100 },
      { os: 'windows', difficulty: 'intermediate', level: 10, title: 'IP Configuration', description: 'ดูหมายเลข IP Address ของเครื่องในระบบ Network', expectedCommand: 'ipconfig', hint: 'ใช้สำหรับดูคอนฟิกของ IP', rewardExp: 200 },
      { os: 'windows', difficulty: 'intermediate', level: 11, title: 'Ping Network', description: 'ทดสอบการเชื่อมต่อเครือข่ายไปยัง google.com', expectedCommand: 'ping google.com', hint: 'พิมพ์ตรงตัวเลย', rewardExp: 200 },
      { os: 'windows', difficulty: 'intermediate', level: 12, title: 'Task List', description: 'ดูรายการโปรแกรมที่กำลังทำงานอยู่ (เทียบเท่า ps ใน Linux)', expectedCommand: 'tasklist', hint: 'พิมพ์ติดกันเลย', rewardExp: 200 }
    ]

    await prisma.mission.createMany({ data: missionsData })

    return c.json({ success: true, message: '✅ เพิ่มข้อมูลด่านทั้งหมด 34 ด่านสำเร็จแล้วบอส!' })
  } catch (error) {
    console.error(error)
    return c.json({ success: false, message: 'การเพิ่มข้อมูลล้มเหลว' }, 500)
  }
})

// ========================================================
// 🚀 ลงทะเบียน Routes อื่นๆ (ทำงานเหมือน app.use ของ Express)
// ========================================================

// แปะเส้นทางเข้าสู่ระบบ Google 
app.route('/api/auth', authRoute)
app.route('/api/user', userRoute)
app.route('/api/leaderboard', leaderboardRoute)
app.route('/api/mission', missionRoute)
app.route('/api/admin', adminRoute)
export default app