-- Migration number: 0007
-- 🖱️ สินค้าใหม่: เอฟเฟกต์เมาส์ — เก็บ itemId ของเอฟเฟกต์ที่ใส่อยู่

ALTER TABLE "User" ADD COLUMN "equippedCursor" TEXT;
