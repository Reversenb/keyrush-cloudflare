// =========================================================================
// 🛍️ แคตตาล็อกสินค้าร้านค้า — server เป็นเจ้าของราคาเท่านั้น
// client ส่งมาแค่ itemId ราคา/ประเภทอ่านจากที่นี่เสมอ (กันแก้ราคาฝั่งหน้าเว็บ)
// เพิ่มของใหม่ = เติม object ในลิสต์นี้ ไม่ต้องแก้ DB
// =========================================================================

export type ShopItemType = 'title' | 'theme' | 'cursor'

export interface ShopItem {
  id: string
  type: ShopItemType
  name: string          // ชื่อที่โชว์ในร้าน
  desc: string
  price: number         // ราคาเป็นเหรียญ
  // สำหรับ type 'title': ข้อความฉายาที่โชว์ข้างชื่อ
  label?: string
  // สำหรับ type 'theme': ชื่อคลาสธีม (ตรงกับที่ประกาศใน globals.css + ThemeProvider)
  themeId?: string
  // สีตัวอย่างไว้โชว์การ์ดพรีวิวในร้าน [พื้นหลัง, สีหลัก, สีรอง]
  preview?: [string, string, string]
  // สำหรับ type 'cursor': รหัสเอฟเฟกต์ (ตรงกับ CURSOR_EFFECTS ใน CursorGlow.tsx) + อีโมจิพรีวิว
  cursorId?: string
  emoji?: string
}

export const SHOP_ITEMS: ShopItem[] = [
  // ===== 🏷️ ฉายา (โชว์ข้างชื่อบน Leaderboard / โปรไฟล์) =====
  { id: 'title_rome', type: 'title', name: 'กรุงโรม', desc: 'กรุงโรมสร้างเสร็จภายในวันเดียว', price: 50, label: 'กรุงโรมสร้างเสร็จภายในวันเดียว' },
  { id: 'title_blacksmith', type: 'title', name: 'นักบิด', desc: 'ฉายาสำหรับสายขี้เกียจ', price: 50, label: 'นักบิด' },
  { id: 'title_blacksmith', type: 'title', name: 'นอนน้อยแต่นอนนะ', desc: 'ฉายาสำหรับสายโต้รุ่ง', price: 50, label: 'นอนน้อยแต่นอนนะ' },
  { id: 'title_blacksmith', type: 'title', name: 'พร้อมลั่น', desc: 'ฉายาสำหรับสายลุย', price: 100, label: 'พร้อมลั่น' },
  { id: 'title_blacksmith', type: 'title', name: 'ศุกร์เหงา', desc: 'ฉายาสำหรับไม่รู้จะทำอะไรเพราะพรุ่งนี้หยุด', price: 100, label: 'ศุกร์เหงา' },
  { id: 'title_rome', type: 'title', name: 'ทาสแมว', desc: 'ฉายาสำหรับคนที่รักแมว', price: 50, label: 'ทาสแมว' },
  { id: 'title_newbie', type: 'title', name: 'มือใหม่ไฟแรง', desc: 'ฉายาสำหรับผู้เริ่มต้นที่ไฟแรงที่สุด', price: 100, label: 'มือใหม่ไฟแรง' },
  { id: 'title_speedster', type: 'title', name: 'สายซิ่ง', desc: 'สำหรับคนที่นิ้วไวกว่าความคิด', price: 300, label: 'สายซิ่ง' },
  { id: 'title_perfectionist', type: 'title', name: 'จอมเป๊ะ', desc: 'พิมพ์ผิดไม่มีในสารบบ', price: 300, label: 'จอมเป๊ะ' },
  { id: 'title_night_owl', type: 'title', name: 'นักล่าราตรี', desc: 'ออกภารกิจตอนดึกเป็นประจำ', price: 500, label: 'นักล่าราตรี' },
  { id: 'title_terminal_lord', type: 'title', name: 'เจ้าแห่งเทอร์มินัล', desc: 'ฉายาระดับตำนานของสาย CLI', price: 1200, label: 'เจ้าแห่งเทอร์มินัล' },
  { id: 'title_keyrush_legend', type: 'title', name: 'ตำนาน KeyRush', desc: 'ฉายาสูงสุด — มีไว้อวดได้เลย', price: 3000, label: 'ตำนาน KeyRush' },

  // ฉายาสายนักเรียน/นักศึกษา 🎓 (ราคาเบาๆ ไล่ขึ้นตามความเทพ)
  { id: 'title_back_row', type: 'title', name: 'เด็กหลังห้อง', desc: 'ที่นั่งประจำคือแถวหลังสุด แต่ใจรักการพิมพ์นะ', price: 50, label: 'เด็กหลังห้อง' },
  { id: 'title_late_riser', type: 'title', name: 'สายตื่นสาย', desc: 'คาบแรกไม่เคยทัน แต่พิมพ์ทันทุกตัวอักษร', price: 80, label: 'สายตื่นสาย' },
  { id: 'title_copy_paste', type: 'title', name: 'เจ้าแห่ง Ctrl+C Ctrl+V', desc: 'ก็อปวางเร็วกว่าแสง (แต่รอบนี้พิมพ์เองจริงๆ)', price: 150, label: 'เจ้าแห่ง Ctrl+C Ctrl+V' },
  { id: 'title_deadline_racer', type: 'title', name: 'นักปั่นเดดไลน์', desc: 'งานเสร็จก่อนเที่ยงคืน 1 นาทีเสมอ ไม่เคยพลาด', price: 200, label: 'นักปั่นเดดไลน์' },
  { id: 'title_group_leader', type: 'title', name: 'หัวหน้ากลุ่มจำยอม', desc: 'งานกลุ่ม 5 คน แต่คนทำจริงมีคนเดียวคือเรา', price: 250, label: 'หัวหน้ากลุ่มจำยอม' },
  { id: 'title_coffee_owl', type: 'title', name: 'สายกาแฟโต้รุ่ง', desc: 'คาเฟอีนคือเลือด เดดไลน์คือแรงผลักดัน', price: 300, label: 'สายกาแฟโต้รุ่ง' },
  { id: 'title_old_karma', type: 'title', name: 'รอดด้วยบุญเก่า', desc: 'สอบผ่านแบบงงๆ มาทุกเทอม สาธุ', price: 400, label: 'รอดด้วยบุญเก่า' },
  { id: 'title_activity_star', type: 'title', name: 'เด็กกิจกรรมตัวท็อป', desc: 'เรียนก็เอา กิจกรรมก็เด่น พิมพ์ก็ไว', price: 500, label: 'เด็กกิจกรรมตัวท็อป' },
  { id: 'title_almost_grad', type: 'title', name: 'ว่าที่บัณฑิต', desc: 'อีกไม่กี่หน่วยกิตก็จะจบแล้ว อดทนไว้', price: 650, label: 'ว่าที่บัณฑิต' },
  { id: 'title_typing_honors', type: 'title', name: 'เกียรตินิยมสายพิมพ์', desc: 'GPA อาจไม่ 4.00 แต่ WPM ท็อปของรุ่น', price: 900, label: 'เกียรตินิยมสายพิมพ์' },

  // ===== 🎨 ธีมเว็บพรีเมียม (เปลี่ยนสีทั้งเว็บ ไม่ใช่แค่ terminal) =====
  {
    id: 'theme_sakura', type: 'theme', themeId: 'sakura',
    name: 'Sakura', desc: 'ธีมชมพูหวานละมุน สดใสน่ารัก เหมาะกับสายหวาน',
    price: 1500, preview: ['#fff1f5', '#ec4899', '#fda4af']
  },
  {
    id: 'theme_dragon', type: 'theme', themeId: 'dragon',
    name: 'Red Dragon', desc: 'ธีมมืดแดงเพลิง ดุดันสายโหด สำหรับนักล่าตัวจริง',
    price: 2500, preview: ['#1a0505', '#ef4444', '#fca5a5']
  },

  // ===== 🖱️ เอฟเฟกต์เมาส์ (เทรลตามเมาส์ — ค่าเริ่มต้นไม่มีเอฟเฟกต์ ต้องซื้อ) =====
  { id: 'cursor_stars', type: 'cursor', cursorId: 'stars', emoji: '⭐', name: 'Star Sparkle', desc: 'ดาวประกายเปลี่ยนสีตามธีมเว็บ คลาสสิกสุดๆ', price: 500 },
  { id: 'cursor_hearts', type: 'cursor', cursorId: 'hearts', emoji: '💗', name: 'Sweet Hearts', desc: 'หัวใจชมพูลอยฟุ้งตามเมาส์ หวานสุดๆ', price: 700 },
  { id: 'cursor_bubbles', type: 'cursor', cursorId: 'bubbles', emoji: '🫧', name: 'Bubble Pop', desc: 'ฟองสบู่ใสๆ ลอยขึ้นเบาๆ สบายตา', price: 700 },
  { id: 'cursor_fire', type: 'cursor', cursorId: 'fire', emoji: '🔥', name: 'Flame Trail', desc: 'เปลวไฟลุกโชนตามทุกการขยับ ร้อนแรง', price: 1000 },
  { id: 'cursor_snow', type: 'cursor', cursorId: 'snow', emoji: '❄️', name: 'Snowfall', desc: 'เกล็ดหิมะโปรยปรายเย็นฉ่ำตามเมาส์', price: 1000 },

  // ระดับพรีเมียม — สวยขึ้น แพงขึ้นตามลำดับ
  { id: 'cursor_butterfly', type: 'cursor', cursorId: 'butterfly', emoji: '🦋', name: 'Butterfly Garden', desc: 'ผีเสื้อโบยบินท่ามกลางดอกไม้บานตามเมาส์', price: 1500 },
  { id: 'cursor_thunder', type: 'cursor', cursorId: 'thunder', emoji: '⚡', name: 'Thunder Strike', desc: 'สายฟ้าฟาดเปรี้ยงทุกการเคลื่อนไหว เร็วแรงทะลุจอ', price: 2000 },
  { id: 'cursor_rainbow', type: 'cursor', cursorId: 'rainbow', emoji: '🌈', name: 'Rainbow Magic', desc: 'สายรุ้งพร้อมดาวระยิบระยับ สดใสทุกองศา', price: 2500 },
  { id: 'cursor_galaxy', type: 'cursor', cursorId: 'galaxy', emoji: '🪐', name: 'Galaxy Dust', desc: 'ฝุ่นกาแล็กซี่ ดาวเสาร์ และแสงดาวลอยล่องในอวกาศ', price: 3500 },
  { id: 'cursor_royal', type: 'cursor', cursorId: 'royal', emoji: '👑', name: 'Royal Aura', desc: 'มงกุฎและเพชรพลอยประกายทอง สมศักดิ์ศรีราชา', price: 5000 },
  { id: 'cursor_dragon', type: 'cursor', cursorId: 'dragonsoul', emoji: '🐉', name: 'Dragon Soul', desc: 'วิญญาณมังกรพ่นไฟคำราม — เอฟเฟกต์ระดับตำนาน', price: 8000 },
]

// หาสินค้าจาก id (ใช้ตอนซื้อ/ใส่ของ)
export const findItem = (id: string): ShopItem | undefined =>
  SHOP_ITEMS.find((i) => i.id === id)
