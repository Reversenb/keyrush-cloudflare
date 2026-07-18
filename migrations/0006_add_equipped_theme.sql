-- Migration number: 0006
-- 🎨 เปลี่ยนสินค้าจาก "ชุดสี terminal" เป็น "ธีมเว็บ"
-- เพิ่มคอลัมน์ใหม่แทนการแก้ของเดิม (คอลัมน์ equippedTerminal ปล่อยไว้ ไม่ได้ใช้แล้ว)

ALTER TABLE "User" ADD COLUMN "equippedTheme" TEXT;
