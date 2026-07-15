-- Migration number: 0004
-- nullable โดยตั้งใจ: record เก่าไม่ต้อง migrate ปล่อยเป็น NULL (frontend แสดง — เอง)
ALTER TABLE "PlayHistory" ADD COLUMN "earnedExp" INTEGER;
