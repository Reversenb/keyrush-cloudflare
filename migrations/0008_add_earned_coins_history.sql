-- Migration number: 0008
-- 🪙 บันทึกเหรียญที่ได้ต่อรอบลงประวัติ (nullable — record เก่าปล่อย NULL, frontend แสดง — เอง)
ALTER TABLE "PlayHistory" ADD COLUMN "earnedCoins" INTEGER;
