// =========================================================================
// 🛍️ แคตตาล็อกสินค้าร้านค้า — server เป็นเจ้าของราคาเท่านั้น
// client ส่งมาแค่ itemId ราคา/ประเภทอ่านจากที่นี่เสมอ (กันแก้ราคาฝั่งหน้าเว็บ)
// เพิ่มของใหม่ = เติม object ในลิสต์นี้ ไม่ต้องแก้ DB
// =========================================================================

export type ShopItemType = 'title' | 'theme' | 'cursor' | 'frame' | 'row'

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
  // สำหรับ type 'frame': รหัสกรอบ (ตรงกับคลาส .kr-frame-<id> ใน globals.css)
  frameId?: string
  // สำหรับ type 'row': รหัสเอฟเฟกต์แถว Leaderboard (ตรงกับคลาส .kr-row-<id> ใน globals.css)
  rowId?: string
}

export const SHOP_ITEMS: ShopItem[] = [
  // ===== 🏷️ ฉายา (โชว์ข้างชื่อบน Leaderboard / โปรไฟล์) =====
  { id: 'title_rome', type: 'title', name: 'กรุงโรม', desc: 'กรุงโรมสร้างเสร็จภายในวันเดียว', price: 50, label: 'กรุงโรมสร้างเสร็จภายในวันเดียว' },
  { id: 'title_ai', type: 'title', name: 'Ai ร่างมนุษย์', desc: 'ฉายาสำหรับคนที่ชอบ AI', price: 100, label: 'Ai ร่างมนุษย์' },
  { id: 'title_bid', type: 'title', name: 'นักบิด', desc: 'ฉายาสำหรับสายขี้เกียจ', price: 50, label: 'นักบิด' },
  { id: 'title_sleepless', type: 'title', name: 'นอนน้อยแต่นอนนะ', desc: 'ฉายาสำหรับสายโต้รุ่ง', price: 50, label: 'นอนน้อยแต่นอนนะ' },
  { id: 'title_ready', type: 'title', name: 'พร้อมลั่น', desc: 'ฉายาสำหรับสายลุย', price: 100, label: 'พร้อมลั่น' },
  { id: 'title_friday', type: 'title', name: 'ศุกร์เหงา', desc: 'ฉายาสำหรับไม่รู้จะทำอะไรเพราะพรุ่งนี้หยุด', price: 100, label: 'ศุกร์เหงา' },
  { id: 'title_cat_servant', type: 'title', name: 'ทาสแมว', desc: 'ฉายาสำหรับคนที่รักแมว', price: 50, label: 'ทาสแมว' },
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
  {
    id: 'theme_sky', type: 'theme', themeId: 'sky',
    name: 'Sky Blue', desc: 'ธีมฟ้าพาสเทลใสสบายตา',
    price: 1500, preview: ['#f0f9ff', '#0ea5e9', '#7dd3fc']
  },
  {
    id: 'theme_mint', type: 'theme', themeId: 'mint',
    name: 'Mint', desc: 'ธีมเขียวมิ้นพาสเทล สดชื่นเย็นตา',
    price: 1000, preview: ['#ecfdf5', '#10b981', '#6ee7b7']
  },

  // ===== 🖱️ เอฟเฟกต์เมาส์ (เทรลตามเมาส์ — ค่าเริ่มต้นไม่มีเอฟเฟกต์ ต้องซื้อ) =====
  { id: 'cursor_stars', type: 'cursor', cursorId: 'stars', emoji: '⭐', name: 'Star', desc: 'ดาวประกาย', price: 500 },
  { id: 'cursor_hearts', type: 'cursor', cursorId: 'hearts', emoji: '💗', name: 'Sweet Hearts', desc: 'หัวใจชมพู', price: 700 },
  { id: 'cursor_bubbles', type: 'cursor', cursorId: 'bubbles', emoji: '🫧', name: 'Bubble Pop', desc: 'ฟองสบู่ใสๆ', price: 700 },
  { id: 'cursor_fire', type: 'cursor', cursorId: 'fire', emoji: '🔥', name: 'Flame Trail', desc: 'เปลวไฟลุกโชน', price: 1000 },
  { id: 'cursor_snow', type: 'cursor', cursorId: 'snow', emoji: '❄️', name: 'Snowfall', desc: 'เกล็ดหิมะ', price: 1000 },
  { id: 'cursor_leaves', type: 'cursor', cursorId: 'leaves', emoji: '🍃', name: 'Leaf Breeze', desc: 'ใบไม้ปลิวลม', price: 1000 },

  // ระดับพรีเมียม — สวยขึ้น แพงขึ้นตามลำดับ
  { id: 'cursor_butterfly', type: 'cursor', cursorId: 'butterfly', emoji: '🦋', name: 'Butterfly Garden', desc: 'ผีเสื้อโบยบินท่ามกลางดอกไม้บานตามเมาส์', price: 1500 },
  { id: 'cursor_thunder', type: 'cursor', cursorId: 'thunder', emoji: '⚡', name: 'Thunder Strike', desc: 'สายฟ้า', price: 2000 },
  { id: 'cursor_rainbow', type: 'cursor', cursorId: 'rainbow', emoji: '🌈', name: 'Rainbow Magic', desc: 'สายรุ้ง', price: 2500 },
  { id: 'cursor_galaxy', type: 'cursor', cursorId: 'galaxy', emoji: '🪐', name: 'Galaxy Dust', desc: 'กาแล็กซี่ ดาวเสาร์', price: 3500 },
  { id: 'cursor_royal', type: 'cursor', cursorId: 'royal', emoji: '👑', name: 'Royal Aura', desc: 'มงกุฎ', price: 5000 },
  { id: 'cursor_dragon', type: 'cursor', cursorId: 'dragonsoul', emoji: '🐉', name: 'Dragon Soul', desc: 'วิญญาณมังกร', price: 8000 },

  // ===== 🖼️ กรอบรูปโปรไฟล์ (โชว์รอบรูปทุกที่ — Navbar / Leaderboard / โปรไฟล์) =====
  // frameId ต้องตรงกับคลาส .kr-frame-<id> ใน globals.css
  { id: 'frame_silver', type: 'frame', frameId: 'silver', name: 'Silver Ring', desc: 'กรอบเงินเรียบหรู เริ่มต้นสายสะสม', price: 800, preview: ['#e2e8f0', '#cbd5e1', '#f8fafc'] },
  { id: 'frame_gold', type: 'frame', frameId: 'gold', name: 'Gold Ring', desc: 'กรอบทองอร่าม บอกทุกคนว่าคุณมาแล้ว', price: 1500, preview: ['#fbbf24', '#f59e0b', '#fef3c7'] },
  { id: 'frame_neon', type: 'frame', frameId: 'neon', name: 'Neon Cyber', desc: 'กรอบนีออนฟ้าเรืองแสง สายไซเบอร์ต้องมี', price: 2000, preview: ['#22d3ee', '#06b6d4', '#cffafe'] },
  { id: 'frame_sakura', type: 'frame', frameId: 'sakura', name: 'Sakura Bloom', desc: 'กรอบชมพูซากุระ ละมุนตาสายหวาน', price: 2000, preview: ['#f472b6', '#ec4899', '#fce7f3'] },
  { id: 'frame_fire', type: 'frame', frameId: 'fire', name: 'Blazing Ring', desc: 'กรอบไฟลุกโชน หมุนวนไม่หยุด', price: 2500, preview: ['#f97316', '#ef4444', '#fed7aa'] },
  { id: 'frame_diamond', type: 'frame', frameId: 'diamond', name: 'Diamond Aura', desc: 'กรอบเพชรระยิบระยับ ความหรูขั้นสุด', price: 3500, preview: ['#a5f3fc', '#e0e7ff', '#ffffff'] },
  { id: 'frame_rainbow', type: 'frame', frameId: 'rainbow', name: 'Rainbow Halo', desc: 'กรอบรุ้งหมุนรอบตัว เด่นที่สุดบนกระดาน', price: 4000, preview: ['#f87171', '#4ade80', '#a78bfa'] },

  // ===== ✨ เอฟเฟกต์แถว Leaderboard (วิ่งผ่านแถวของเราทุกๆ ~10 วิ ให้คนอื่นเห็น) =====
  // rowId ต้องตรงกับคลาส .kr-row-<id> ใน globals.css
  { id: 'row_ember', type: 'row', rowId: 'ember', name: 'Ember Trail', desc: 'ประกายไฟอุ่นๆ วิ่งผ่านแถวของคุณเป็นระยะ', price: 2500, preview: ['#fff7ed', '#f97316', '#fbbf24'] },
  { id: 'row_frost', type: 'row', rowId: 'frost', name: 'Frost Wave', desc: 'คลื่นน้ำแข็งเย็นเฉียบกวาดผ่านแถว', price: 2500, preview: ['#f0f9ff', '#38bdf8', '#a5f3fc'] },
  { id: 'row_thunder', type: 'row', rowId: 'thunder', name: 'Thunder Strike', desc: 'สายฟ้าฟาดวาบ สะดุดตาสุดๆ', price: 3500, preview: ['#fefce8', '#facc15', '#fde68a'] },
  { id: 'row_gold', type: 'row', rowId: 'gold', name: 'Golden Shine', desc: 'แสงทองไหลผ่านแถว บอกความมั่งคั่ง', price: 4500, preview: ['#fffbeb', '#f59e0b', '#fef3c7'] },
  { id: 'row_matrix', type: 'row', rowId: 'matrix', name: 'Matrix Scan', desc: 'ลำแสงเขียวสแกนแถวแบบสายแฮก', price: 5000, preview: ['#052e16', '#22c55e', '#86efac'] },
  { id: 'row_inferno', type: 'row', rowId: 'inferno', name: 'Inferno Blaze', desc: 'เปลวเพลิงลุกท่วมทั้งแถว ระดับตำนาน', price: 7000, preview: ['#1a0505', '#ef4444', '#fb923c'] },
  { id: 'row_prism', type: 'row', rowId: 'prism', name: 'Prism Flow', desc: 'แสงรุ้งไหลผ่านแถว หรูที่สุดในร้าน', price: 8000, preview: ['#faf5ff', '#a78bfa', '#f472b6'] },

  // รุ่นใหม่ — เอฟเฟกต์อนุภาค/บรรยากาศ จัดเต็มกว่าเดิม
  { id: 'row_sakura', type: 'row', rowId: 'sakura', name: 'Sakura Drift', desc: 'กลีบซากุระปลิวโปรยผ่านแถวของคุณ', price: 3000, preview: ['#fff1f5', '#f472b6', '#fbcfe8'] },
  { id: 'row_ocean', type: 'row', rowId: 'ocean', name: 'Ocean Bubbles', desc: 'ฟองคลื่นทะเลลอยขึ้นเป็นระลอก', price: 3000, preview: ['#eff6ff', '#38bdf8', '#a5f3fc'] },
  { id: 'row_void', type: 'row', rowId: 'void', name: 'Void Whisper', desc: 'หมอกมืดสีม่วงคืบคลานจากสองฟาก น่าขนลุก', price: 5500, preview: ['#1e1b4b', '#a78bfa', '#6d28d9'] },
  { id: 'row_galaxy', type: 'row', rowId: 'galaxy', name: 'Starfall Galaxy', desc: 'ทุ่งดาวระยิบ พร้อมดาวตกพาดผ่าน', price: 6000, preview: ['#0f172a', '#a5b4fc', '#e0e7ff'] },
  { id: 'row_glitch', type: 'row', rowId: 'glitch', name: 'Cyber Glitch', desc: 'สัญญาณภาพแตกซ่า RGB สายไซเบอร์พังก์', price: 6500, preview: ['#0a0a0a', '#22d3ee', '#f43f5e'] },
]

// หาสินค้าจาก id (ใช้ตอนซื้อ/ใส่ของ)
export const findItem = (id: string): ShopItem | undefined =>
  SHOP_ITEMS.find((i) => i.id === id)
