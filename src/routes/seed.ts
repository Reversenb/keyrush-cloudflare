import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import type { D1Database } from '@cloudflare/workers-types'

// 🌟 ต้องเอา Bindings มาใส่ด้วย ไฟล์นี้จะได้รู้จักกับ D1 และ SEED_PASSWORD
type Bindings = {
  DB: D1Database
  JWT_SECRET: string 
  SEED_PASSWORD: string
}

const seedRoute = new Hono<{ Bindings: Bindings }>()



const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};


seedRoute.use('*', async (c, next) => {
  const userSecret = c.req.header('X-Seed-Secret') || '';
  
  if (!timingSafeEqual(userSecret, c.env.SEED_PASSWORD)) {
    return c.json({ error: 'Access Denied! Hacker detected 🚨' }, 403)
  }
  await next()
})

// ==========================================
// 🌱 1. เสกข้อมูลด่าน 34 ด่าน (URL: /api/seed)
// ==========================================
seedRoute.get('/', async (c) => {
  try {
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    await prisma.mission.deleteMany({})

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
    return c.json({ success: true, message: '✅ เพิ่มข้อมูลด่านทั้งหมด 34 ด่านสำเร็จแล้วMP' })
  } catch (error) {
    console.error(error)
    return c.json({ success: false, message: 'การเพิ่มข้อมูลล้มเหลว' }, 500)
  }
})

// ==========================================
// 📚 2. เสกข้อมูลคู่มือคำสั่ง (URL: /api/seed/docs)
// ==========================================
seedRoute.get('/docs', async (c) => {
  try {
    const adapter = new PrismaD1(c.env.DB)
    const prisma = new PrismaClient({ adapter })

    await prisma.commandDoc.deleteMany({})

    const docsData = [
      
      { id: 'L01', os: 'linux', category: 'File System', command: 'ls', description: 'แสดงรายชื่อไฟล์และโฟลเดอร์ในไดเรกทอรีปัจจุบัน', example: 'ls -lah' },
      { id: 'L02', os: 'linux', category: 'File System', command: 'cd', description: 'เปลี่ยนไดเรกทอรี (Change Directory)', example: 'cd /var/www/html' },
      { id: 'L03', os: 'linux', category: 'File System', command: 'pwd', description: 'แสดง Path เต็มของไดเรกทอรีปัจจุบันที่ทำงานอยู่', example: 'pwd' },
      { id: 'L04', os: 'linux', category: 'File System', command: 'mkdir', description: 'สร้างโฟลเดอร์ใหม่ (Make Directory)', example: 'mkdir project_files' },
      { id: 'L05', os: 'linux', category: 'File System', command: 'rmdir', description: 'ลบโฟลเดอร์ที่ว่างเปล่า', example: 'rmdir old_folder' },
      { id: 'L06', os: 'linux', category: 'File System', command: 'touch', description: 'สร้างไฟล์เปล่าใหม่ หรืออัปเดตเวลาเข้าถึงไฟล์', example: 'touch index.html' },
      { id: 'L07', os: 'linux', category: 'File System', command: 'cp', description: 'คัดลอกไฟล์หรือโฟลเดอร์', example: 'cp config.json config.backup.json' },
      { id: 'L08', os: 'linux', category: 'File System', command: 'mv', description: 'ย้ายไฟล์/โฟลเดอร์ หรือใช้สำหรับเปลี่ยนชื่อ', example: 'mv app.js src/app.js' },
      { id: 'L09', os: 'linux', category: 'File System', command: 'rm', description: 'ลบไฟล์หรือโฟลเดอร์', example: 'rm -rf cache_folder' },
      { id: 'L10', os: 'linux', category: 'Text Processing', command: 'cat', description: 'แสดงเนื้อหาภายในไฟล์ทั้งหมดออกทางหน้าจอ', example: 'cat text.txt' },
      { id: 'L11', os: 'linux', category: 'Text Processing', command: 'less', description: 'เปิดอ่านเนื้อหาไฟล์ขนาดใหญ่แบบทีละหน้า', example: 'less server.log' },
      { id: 'L12', os: 'linux', category: 'Text Processing', command: 'head', description: 'แสดงเนื้อหาไฟล์ส่วนหัว (เริ่มต้น 10 บรรทัดแรก)', example: 'head -n 20 error.log' },
      { id: 'L13', os: 'linux', category: 'Text Processing', command: 'tail', description: 'แสดงเนื้อหาไฟล์ส่วนท้าย (นิยมใช้ดู Log สด)', example: 'tail -f output.log' },
      { id: 'L14', os: 'linux', category: 'Text Processing', command: 'grep', description: 'ค้นหาข้อความหรือคำในไฟล์ตามเงื่อนไข', example: 'grep "ERROR" auth.log' },
      { id: 'L15', os: 'linux', category: 'Text Processing', command: 'find', description: 'ค้นหาไฟล์หรือโฟลเดอร์ในระบบ', example: 'find . -name "*.js"' },
      { id: 'L16', os: 'linux', category: 'Permissions', command: 'chmod', description: 'เปลี่ยนสิทธิ์การเข้าถึงไฟล์ (Read, Write, Execute)', example: 'chmod 755 script.sh' },
      { id: 'L17', os: 'linux', category: 'Permissions', command: 'chown', description: 'เปลี่ยนเจ้าของไฟล์หรือกลุ่มครอบครอง', example: 'chown nginx:nginx index.html' },
      { id: 'L18', os: 'linux', category: 'System Information', command: 'df', description: 'ตรวจสอบพื้นที่ว่างและการใช้งานบนฮาร์ดดิสก์ทั้งหมด', example: 'df -h' },
      { id: 'L19', os: 'linux', category: 'System Information', command: 'du', description: 'ตรวจสอบขนาดพื้นที่ที่โฟลเดอร์นั้นใช้งาน', example: 'du -sh *' },
      { id: 'L20', os: 'linux', category: 'System Information', command: 'free', description: 'ตรวจสอบการใช้งานหน่วยความจำ (RAM) และ Swap', example: 'free -m' },
      { id: 'L21', os: 'linux', category: 'Process Management', command: 'top', description: 'แสดงรายการ Process และการทำงานระบบแบบ Real-time', example: 'top' },
      { id: 'L22', os: 'linux', category: 'Process Management', command: 'htop', description: 'เครื่องมือดู Process แบบกราฟิกสีสันสวยงามใน Terminal', example: 'htop' },
      { id: 'L23', os: 'linux', category: 'Process Management', command: 'ps', description: 'แสดงรายการ Process ที่กำลังทำงานอยู่ปัจจุบัน', example: 'ps aux' },
      { id: 'L24', os: 'linux', category: 'Process Management', command: 'kill', description: 'สั่งปิดหรือยกเลิกการทำงานของ Process ด้วย ID (PID)', example: 'kill 1234' },
      { id: 'L25', os: 'linux', category: 'Process Management', command: 'pkill', description: 'สั่งปิด Process ด้วยชื่อของโปรแกรม', example: 'pkill node' },
      { id: 'L26', os: 'linux', category: 'Service Management', command: 'systemctl', description: 'จัดการ และตรวจสอบสถานะของ Service ในระบบ', example: 'systemctl status nginx' },
      { id: 'L27', os: 'linux', category: 'Service Management', command: 'service', description: 'จัดการ Service (คำสั่งแบบเก่าที่ยังใช้งานได้)', example: 'service mysql restart' },
      { id: 'L28', os: 'linux', category: 'Network', command: 'ping', description: 'ทดสอบการเชื่อมต่อเครือข่ายไปยัง IP หรือโดเมน', example: 'ping -c 4 google.com' },
      { id: 'L29', os: 'linux', category: 'Network', command: 'ifconfig', description: 'ดูและตั้งค่าการ์ดจอเน็ตเวิร์ก (คำสั่งดั้งเดิม)', example: 'ifconfig' },
      { id: 'L30', os: 'linux', category: 'Network', command: 'ip', description: 'ดูข้อมูลและจัดการไอพีแอดเดรส (คำสั่งมาตรฐานใหม่)', example: 'ip addr show' },
      { id: 'L31', os: 'linux', category: 'Network', command: 'netstat', description: 'ตรวจสอบการเชื่อมต่อเน็ตเวิร์กและพอร์ตที่เปิดอยู่', example: 'netstat -tuln' },
      { id: 'L32', os: 'linux', category: 'Network', command: 'ss', description: 'ตรวจสอบ Socket และพอร์ตอินเทอร์เน็ต (เร็วกว่า netstat)', example: 'ss -tulpn' },
      { id: 'L33', os: 'linux', category: 'Network', command: 'curl', description: 'ส่งคำขอไปยัง URL เพื่อดึงข้อมูลหรือทดสอบ API', example: 'curl -I https://api.com' },
      { id: 'L34', os: 'linux', category: 'Network', command: 'wget', description: 'ดาวน์โหลดไฟล์จากอินเทอร์เน็ตผ่านลิงก์ URL', example: 'wget https://site.com/file.zip' },
      { id: 'L35', os: 'linux', category: 'Network', command: 'ssh', description: 'เชื่อมต่อระยะไกลไปยังเซิร์ฟเวอร์ปลายทางแบบปลอดภัย', example: 'ssh root@192.168.1.50' },
      { id: 'L36', os: 'linux', category: 'Network', command: 'scp', description: 'คัดลอกไฟล์ข้ามเครื่องเซิร์ฟเวอร์ผ่านระบบ SSH', example: 'scp file.txt user@remote:/home/' },
      { id: 'L37', os: 'linux', category: 'Network', command: 'rsync', description: 'ซิงค์ข้อมูลไฟล์และโฟลเดอร์ระหว่างเครื่องแบบเร็ว', example: 'rsync -avz src/ dest/' },
      { id: 'L38', os: 'linux', category: 'Archive / Compression', command: 'tar', description: 'บีบอัดไฟล์หรือแตกไฟล์นามสกุล .tar.gz', example: 'tar -xvf archive.tar.gz' },
      { id: 'L39', os: 'linux', category: 'Archive / Compression', command: 'gzip', description: 'บีบอัดไฟล์เดียวให้กลายเป็นนามสกุล .gz', example: 'gzip data.txt' },
      { id: 'L40', os: 'linux', category: 'Archive / Compression', command: 'gunzip', description: 'แตกไฟล์บีบอัดนามสกุล .gz', example: 'gunzip data.txt.gz' },
      { id: 'L41', os: 'linux', category: 'Archive / Compression', command: 'zip', description: 'บีบอัดไฟล์และโฟลเดอร์เป็นนามสกุล .zip', example: 'zip -r compressed.zip folder/' },
      { id: 'L42', os: 'linux', category: 'Archive / Compression', command: 'unzip', description: 'แตกไฟล์บีบอัดไฟล์นามสกุล .zip', example: 'unzip archive.zip' },
      { id: 'L43', os: 'linux', category: 'System Information', command: 'uname', description: 'แสดงข้อมูลสถาปัตยกรรมของ Kernel และระบบปฏิบัติการ', example: 'uname -a' },
      { id: 'L44', os: 'linux', category: 'System Information', command: 'uptime', description: 'ดูระยะเวลาที่เซิร์ฟเวอร์เปิดทำงานต่อเนื่องมาแล้ว', example: 'uptime' },
      { id: 'L45', os: 'linux', category: 'System Information', command: 'hostname', description: 'แสดงชื่อเครื่องคอมพิวเตอร์ปัจจุบัน', example: 'hostname' },
      { id: 'L46', os: 'linux', category: 'User Management', command: 'whoami', description: 'แสดงชื่อผู้ใช้งาน (User) ที่กำลังล็อกอินอยู่ปัจจุบัน', example: 'whoami' },
      { id: 'L47', os: 'linux', category: 'User Management', command: 'id', description: 'แสดงรหัสประจำตัวผู้ใช้ (UID) และกลุ่ม (GID)', example: 'id root' },
      { id: 'L48', os: 'linux', category: 'User Management', command: 'sudo', description: 'รันคำสั่งในสิทธิ์ผู้ดูแลระบบสูงสุด (Superuser)', example: 'sudo apt update' },
      { id: 'L49', os: 'linux', category: 'User Management', command: 'passwd', description: 'เปลี่ยนรหัสผ่านของผู้ใช้งานระบบ', example: 'passwd username' },
      { id: 'L50', os: 'linux', category: 'Utility', command: 'history', description: 'แสดงประวัติคำสั่งทั้งหมดที่เคยพิมพ์ไปก่อนหน้านี้', example: 'history' },
      // === Windows Commands (W01 - W50) ===
      { id: 'W01', os: 'windows', category: 'File System', command: 'dir', description: 'แสดงรายชื่อไฟล์และโฟลเดอร์ย่อยในโฟลเดอร์ปัจจุบัน', example: 'dir /w' },
      { id: 'W02', os: 'windows', category: 'File System', command: 'cd', description: 'เปลี่ยนตำแหน่งโฟลเดอร์ปัจจุบันไปยัง Path อื่น', example: 'cd C:\\Projects' },
      { id: 'W03', os: 'windows', category: 'File System', command: 'mkdir', description: 'สร้างโฟลเดอร์ใหม่ย่อยในระบบ', example: 'mkdir WindowsData' },
      { id: 'W04', os: 'windows', category: 'File System', command: 'rmdir', description: 'ลบโฟลเดอร์ออกจากระบบปฏิบัติการ', example: 'rmdir /s /q old_cache' },
      { id: 'W05', os: 'windows', category: 'File System', command: 'type', description: 'แสดงเนื้อหาข้อความภายในไฟล์แสดงผลบนจอ', example: 'type settings.env' },
      { id: 'W06', os: 'windows', category: 'File System', command: 'copy', description: 'คัดลอกไฟล์จากที่หนึ่งไปยังที่หนึ่ง', example: 'copy note.txt D:\\Backup\\' },
      { id: 'W07', os: 'windows', category: 'File System', command: 'xcopy', description: 'คัดลอกไฟล์และโครงสร้างโฟลเดอร์ย่อยทั้งหมด', example: 'xcopy /s src D:\\dest\\' },
      { id: 'W08', os: 'windows', category: 'File System', command: 'robocopy', description: 'เครื่องมือคัดลอกไฟล์ประสิทธิภาพสูง ปลอดภัยกว่า', example: 'robocopy source dest /mir' },
      { id: 'W09', os: 'windows', category: 'File System', command: 'move', description: 'ย้ายไฟล์ไปยังตำแหน่งใหม่ หรือใช้เปลี่ยนชื่อไฟล์', example: 'move data.csv D:\\archived\\' },
      { id: 'W10', os: 'windows', category: 'File System', command: 'del', description: 'ลบไฟล์ออกจากหน่วยความจำคอมพิวเตอร์', example: 'del *.tmp' },
      { id: 'W11', os: 'windows', category: 'File System', command: 'ren', description: 'เปลี่ยนชื่อไฟล์หรือโฟลเดอร์ใหม่', example: 'ren old.txt new.txt' },
      { id: 'W12', os: 'windows', category: 'Utility', command: 'cls', description: 'ล้างหน้าจอ Command Prompt ให้สะอาดโล่ง', example: 'cls' },
      { id: 'W13', os: 'windows', category: 'System Information', command: 'systeminfo', description: 'แสดงข้อมูลฮาร์ดแวร์ ซอฟต์แวร์ และเวอร์ชันของ Windows', example: 'systeminfo' },
      { id: 'W14', os: 'windows', category: 'System Information', command: 'ver', description: 'แสดงเวอร์ชันของระบบปฏิบัติการ Windows ปัจจุบัน', example: 'ver' },
      { id: 'W15', os: 'windows', category: 'System Information', command: 'hostname', description: 'แสดงชื่อเครื่องคอมพิวเตอร์บนเครือข่ายเน็ตเวิร์ก', example: 'hostname' },
      { id: 'W16', os: 'windows', category: 'Process Management', command: 'tasklist', description: 'แสดงรายการแอปและบริการทั้งหมดที่กำลังรันอยู่', example: 'tasklist' },
      { id: 'W17', os: 'windows', category: 'Process Management', command: 'taskkill', description: 'สั่งยกเลิกหรือปิดโปรแกรมที่เปิดทำงานค้างอยู่', example: 'taskkill /PID 4520 /F' },
      { id: 'W18', os: 'windows', category: 'Network', command: 'ipconfig', description: 'แสดงที่อยู่ไอพีแอดเดรสและรายละเอียดเครือข่ายเครื่อง', example: 'ipconfig /all' },
      { id: 'W19', os: 'windows', category: 'Network', command: 'ping', description: 'ทดสอบการส่งข้อมูลไปยังเป้าหมายเครือข่ายปลายทาง', example: 'ping 8.8.8.8' },
      { id: 'W20', os: 'windows', category: 'Network', command: 'tracert', description: 'ตรวจรอยเส้นทางการเดินทางของข้อมูลผ่านเราเตอร์ต่างๆ', example: 'tracert google.com' },
      { id: 'W21', os: 'windows', category: 'Network', command: 'netstat', description: 'แสดงการเชื่อมต่อเครือข่ายเข้าออกของเครื่องคอมพิวเตอร์', example: 'netstat -an' },
      { id: 'W22', os: 'windows', category: 'Network', command: 'nslookup', description: 'ตรวจสอบข้อมูล IP ของโดเมนเนมเน็ตเวิร์กอินเทอร์เน็ต', example: 'nslookup github.com' },
      { id: 'W23', os: 'windows', category: 'Network', command: 'getmac', description: 'ตรวจสอบค่าที่อยู่ทางกายภาพ (Mac Address) ของเน็ต', example: 'getmac' },
      { id: 'W24', os: 'windows', category: 'Network', command: 'netsh', description: 'เครื่องมือวิเคราะห์และตั้งค่าเครือข่ายขั้นสูง', example: 'netsh wlan show profiles' },
      { id: 'W25', os: 'windows', category: 'Disk Management', command: 'chkdsk', description: 'สแกนตรวจสอบและซ่อมแซมจุดเสียบนฮาร์ดดิสก์ไดรฟ์', example: 'chkdsk C: /f' },
      { id: 'W26', os: 'windows', category: 'Disk Management', command: 'diskpart', description: 'เครื่องมือจัดการแบ่งพาร์ทิชันดิสก์คอมพิวเตอร์', example: 'diskpart' },
      { id: 'W27', os: 'windows', category: 'Disk Management', command: 'wmic', description: 'ระบบดึงข้อมูลระดับลึกภายในอุปกรณ์คอมพิวเตอร์', example: 'wmic diskdrive get model,size' },
      { id: 'W28', os: 'windows', category: 'System Utilities', command: 'sfc', description: 'ตรวจสอบไฟล์ระบบของ Windows ที่เสียหายเพื่อกู้คืน', example: 'sfc /scannow' },
      { id: 'W29', os: 'windows', category: 'System Utilities', command: 'dism', description: 'ตรวจสอบสถานะความสมบูรณ์และซ่อมแซม Windows Image', example: 'dism /online /cleanup-image /restorehealth' },
      { id: 'W30', os: 'windows', category: 'System Utilities', command: 'format', description: 'ล้างข้อมูลไฟล์และรีเซ็ตระบบไฟล์ของไดรฟ์ที่กำหนด', example: 'format E: /fs:ntfs' },
      { id: 'W31', os: 'windows', category: 'File System', command: 'attrib', description: 'แสดงหรือเปลี่ยนคุณลักษณะ of ไฟล์ (เช่น ซ่อนไฟล์)', example: 'attrib +h hidden_file.txt' },
      { id: 'W32', os: 'windows', category: 'Permissions', command: 'icacls', description: 'ดูและจัดการแก้ไขสิทธิ์ในการเข้าถึงไฟล์ระบบ (ACLs)', example: 'icacls folder /grant Everyone:F' },
      { id: 'W33', os: 'windows', category: 'Security', command: 'cipher', description: 'แสดงสถานะหรือทำการเข้ารหัสไฟล์ความปลอดภัยบนดิสก์', example: 'cipher /e secure_data' },
      { id: 'W34', os: 'windows', category: 'User Management', command: 'net user', description: 'จัดการ ตรวจสอบ ดูรายชื่อบัญชีผู้ใช้งานระบบคอมพิวเตอร์', example: 'net user Administrator' },
      { id: 'W35', os: 'windows', category: 'User Management', command: 'net localgroup', description: 'ดูหรือเพิ่มสิทธิ์รายชื่อผู้ใช้ในกลุ่มต่างๆ ของเครื่อง', example: 'net localgroup Administrators User /add' },
      { id: 'W36', os: 'windows', category: 'Permissions', command: 'runas', description: 'สั่งรันโปรแกรมด้วยสิทธิ์บัญชีผู้ใช้อื่นหรือแอดมิน', example: 'runas /user:Administrator cmd.exe' },
      { id: 'W37', os: 'windows', category: 'Security', command: 'gpupdate', description: 'สั่งอัปเดตการตั้งค่าสิทธิ์กลุ่มความปลอดภัยทันที', example: 'gpupdate /force' },
      { id: 'W38', os: 'windows', category: 'Security', command: 'gpresult', description: 'ตรวจสอบการตั้งค่านโยบายกลุ่มที่ส่งผลต่อเครื่องนี้', example: 'gpresult /R' },
      { id: 'W39', os: 'windows', category: 'System Utilities', command: 'assoc', description: 'ตรวจสอบหรือแก้ไขการผูกมัดนามสกุลไฟล์เข้ากับโปรแกรม', example: 'assoc .txt' },
      { id: 'W40', os: 'windows', category: 'System Utilities', command: 'ftype', description: 'ดูหรือเปลี่ยนประเภทไฟล์ที่ใช้รันกับระบบไฟล์', example: 'ftype txtfile' },
      { id: 'W41', os: 'windows', category: 'Text Processing', command: 'fc', description: 'เปรียบเทียบความแตกต่างระหว่างไฟล์สองไฟล์เพื่อดูจุดต่าง', example: 'fc file1.txt file2.txt' },
      { id: 'W42', os: 'windows', category: 'Text Processing', command: 'comp', description: 'เปรียบเทียบไฟล์สองชุดตามจำนวนไบต์ข้อมูลภายใน', example: 'comp file1.txt file2.txt' },
      { id: 'W43', os: 'windows', category: 'Text Processing', command: 'find', description: 'ค้นหาข้อความธรรมดาภายในไฟล์เอกสาร', example: 'find "ADMIN" application.log' },
      { id: 'W44', os: 'windows', category: 'Text Processing', command: 'findstr', description: 'ค้นหาข้อความในไฟล์ด้วยเงื่อนไขขั้นสูง (Regex)', example: 'findstr /R "^[0-9]" data.txt' },
      { id: 'W45', os: 'windows', category: 'Utility', command: 'date', description: 'แสดงผลหรือเปลี่ยนการตั้งค่าวันที่ของระบบคอมพิวเตอร์', example: 'date /t' },
      { id: 'W46', os: 'windows', category: 'Utility', command: 'time', description: 'แสดงผลหรือเปลี่ยนเวลาปัจจุบันของระบบคอมพิวเตอร์', example: 'time /t' },
      { id: 'W47', os: 'windows', category: 'Environment', command: 'path', description: 'แสดงรายชื่อ Path ของระบบที่ใช้ค้นหาโปรแกรมเวลาเรียกใช้งาน', example: 'path' },
      { id: 'W48', os: 'windows', category: 'Environment', command: 'set', description: 'แสดง บันทึก หรือลบตัวแปรสภาพแวดล้อม (Environment)', example: 'set NODE_ENV=production' },
      { id: 'W49', os: 'windows', category: 'Utility', command: 'echo', description: 'แสดงข้อความออกหน้าจอ หรือใช้ส่งค่าใส่ไฟล์ข้อความ', example: 'echo Hello World > log.txt' },
      { id: 'W50', os: 'windows', category: 'Utility', command: 'exit', description: 'สั่งปิดหน้าต่างโปรแกรม Command Prompt ปัจจุบันลงทันที', example: 'exit' }
    ]
    

    await prisma.commandDoc.createMany({ data: docsData })
    return c.json({ success: true, message: '✅ เพิ่มข้อมูลคู่มือคำสั่ง (Docs) สำเร็จแล้วMP' })
  } catch (error) {
    console.error(error)
    return c.json({ success: false, message: 'การเพิ่มข้อมูลล้มเหลว' }, 500)
  }
})

export default seedRoute