-- 👀 View สำหรับส่องข้อมูล UserItem แบบรู้ว่าใครเป็นเจ้าของ (แก้ปัญหาเห็นแต่ userId ที่เป็น UUID)
-- ใช้แค่ตอนดูข้อมูลใน D1 เฉยๆ ไม่กระทบการทำงานของแอป/Prisma
-- ดูได้ด้วย: npx wrangler d1 execute keyrush-db --remote --command "SELECT * FROM UserItemView"
DROP VIEW IF EXISTS "UserItemView";
CREATE VIEW "UserItemView" AS
SELECT
  ui."id",
  u."username"    AS "username",
  u."displayName" AS "displayName",
  ui."itemId",
  ui."createdAt",
  ui."userId"
FROM "UserItem" ui
JOIN "User" u ON ui."userId" = u."id";
