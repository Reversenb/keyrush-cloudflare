import { defineConfig } from "prisma/config";


export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: "file:./dev.db", // 🌟 ใส่ค่าตรงๆ ลงไปเลย ไม่ต้องง้อไฟล์ .env แล้ว!
  },
});