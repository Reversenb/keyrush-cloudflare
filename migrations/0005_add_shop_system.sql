-- Migration number: 0005
-- 🛍️ ระบบร้านค้า: เหรียญ + ของที่ซื้อไว้ + ของที่ใส่อยู่
-- เหรียญได้จากการเล่นเท่านั้น (server แจกในจุดที่ผ่านระบบตรวจแล้ว)

ALTER TABLE "User" ADD COLUMN "coins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "equippedTitle" TEXT;
ALTER TABLE "User" ADD COLUMN "equippedTerminal" TEXT;

-- CreateTable
CREATE TABLE "UserItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- กันซื้อซ้ำชิ้นเดิม
CREATE UNIQUE INDEX "UserItem_userId_itemId_key" ON "UserItem"("userId", "itemId");
