# KeyRush API (Backend)

Backend ของเกมฝึกพิมพ์คำสั่ง Linux / Windows **KeyRush** สร้างด้วย **Hono** รันบน **Cloudflare Workers** ใช้ฐานข้อมูล **Cloudflare D1 (SQLite)** ผ่าน **Prisma ORM**

> Frontend (Next.js) อยู่คนละ repository และ deploy แยกบน Vercel — repo นี้เป็น **API อย่างเดียว**

---

## 🧱 Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Framework | Hono 4 |
| Runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| ORM | Prisma 7 + `@prisma/adapter-d1` |
| Validation | Zod 4 + `@hono/zod-validator` |
| Auth | Google OAuth (token flow) + JWT ใน HttpOnly Cookie |
| Language | TypeScript |

---

## 🔐 สถาปัตยกรรมความปลอดภัย (Defense in Depth)

request ที่วิ่งเข้า `/api/*` จะผ่านด่านตามลำดับนี้ (กำหนดใน [`src/index.ts`](src/index.ts)):

1. **CORS** — อนุญาตเฉพาะ origin ที่กำหนด (`localhost:3000`, `keyrush-swart.vercel.app`) พร้อม `credentials: true` ไม่ใช้ `*`
2. **Secure Headers** — `secureHeaders()` + CSP (`default-src 'none'`), HSTS, Permissions-Policy
3. **Rate Limiter** — จำกัด 30 request/นาที/IP (อ่าน IP จาก `cf-connecting-ip`) ยกเว้น `/api/survival/answer` ที่แยกโควตาเป็น 90/นาที เพราะถูกยิงทุกข้อระหว่างเล่น
4. **CSRF Protection** — double-submit cookie สำหรับ POST/PUT/DELETE/PATCH (ข้าม `/api/auth/google`)

### ระบบ Authentication
- Login ด้วย Google: frontend ขอ `access_token` จาก Google แล้วส่งให้ backend → backend ตรวจกับ Google 3 ด่าน (**token ถูกต้อง + `aud` ตรงกับ Client ID + `email_verified`**)
- ออก JWT ของ KeyRush เอง เก็บใน **HttpOnly Cookie** (`auth_token`) — JavaScript ฝั่งหน้าเว็บอ่านไม่ได้ กัน XSS ขโมย token
- คุกกี้ตั้งเป็น `HttpOnly; Secure; SameSite=None; Path=/` (frontend/backend คนละโดเมน)
- **JWT อายุ 4 ชั่วโมง** + ฝัง claim `tokenVersion`
- **Token Revocation:** ทุก request ที่ต้อง auth จะ query `tokenVersion` จาก DB เทียบกับใน JWT — logout จะ `tokenVersion + 1` ทำให้ token เก่าทุกใบใช้ไม่ได้ทันที (แลกกับ DB read เพิ่ม 1 ครั้ง/request)
- **CSRF:** ออก cookie `csrf_token` (อ่านได้จาก JS) frontend ต้องอ่านค่าไปแนบเป็น header `X-CSRF-Token` ตอนเรียก method ที่เปลี่ยนข้อมูล

### ระบบกันโกง (Server-Authoritative Anti-Cheat)
คะแนน/EXP ถูกควบคุมด้วย "ตั๋วที่ server เซ็นเอง" (JWT ด้วย `JWT_SECRET` เดิม ไม่เก็บลง DB):

- **sessionToken** — ออกตอนดึงโจทย์ (`GET /api/mission/:os/:level`) ฝังเวลาเริ่มด่าน
- **clearanceToken** — ออกตอน `POST /api/mission/verify` ตอบถูกเท่านั้น ผูกกับ user + os + level
- `PUT /api/user/progress` **บังคับต้องมี clearanceToken** ที่ถูกต้อง → ปิดช่องฟาร์ม EXP ด้วยการยิง API ตรงๆ
- ตรวจจับบอท: ถ้าตอบถูกเร็วกว่าที่มนุษย์พิมพ์ได้ (เพดาน 400 WPM) → ปฏิเสธ
- **ปุ่มดูเฉลย** (`POST /api/mission/reveal`) — server บันทึก `usedReveal` ลง DB ทันที ด่านที่เคยกดเฉลยจะได้ EXP แค่ **20%**
- **โหมด Survival** ใช้ **rolling token**: ทุกคำตอบที่ส่งไป `POST /api/survival/answer` server จะตรวจเอง นับข้อที่ถูกไว้ในตั๋ว แล้วออกตั๋วใบใหม่ให้ — client ส่งจำนวนข้อที่ทำได้เองไม่ได้ ตอนจบเกม `POST /api/survival/submit` อ่านแต้มจากตั๋วใบล่าสุดเท่านั้น
- **ตรวจคำตอบ** ([`src/lib/answerCheck.ts`](src/lib/answerCheck.ts)) — เทียบแบบไม่สนตัวพิมพ์เล็ก/ใหญ่ทั้ง Linux และ Windows เพราะระบบไฟล์บนเครื่องที่ผู้เรียนใช้จริง (Git Bash / WSL บน `/mnt/c`, macOS APFS, Windows) ไม่แยกตัวพิมพ์ — พิมพ์ `MKDIR` ก็ทำงานได้จริง
  > ⚠️ หน้าเว็บโหมด Survival ตัดสินถูก/ผิดเองด้วยเพื่อเด้งไฟเขียว/แดงทันที กติกาสองฝั่งต้องตรงกันเป๊ะ (ดู `Keyrush-frontend/lib/answerCheck.ts`)
- **กรองคำหยาบ** ([`src/lib/profanity.ts`](src/lib/profanity.ts)) — ตรวจ `displayName` / `bio` ที่ฝั่ง server เพราะกรองแค่หน้าเว็บเลี่ยงได้ด้วยการยิง API ตรง

> **ข้อจำกัดที่ทราบ:** WPM / Accuracy คำนวณฝั่ง frontend และ backend เชื่อค่าที่ส่งมา — แต่ค่าเหล่านี้เป็นสถิติส่วนตัว **ไม่มีผลต่อ leaderboard** (จัดอันดับด้วย EXP) จึงไม่ใช่ความเสี่ยงเชิงระบบ

---

## 🗃️ Data Model ([`prisma/schema.prisma`](prisma/schema.prisma))

| Model | หน้าที่ | ฟิลด์สำคัญ |
|---|---|---|
| `User` | ผู้เล่น + ความคืบหน้า + กระเป๋าเงิน | `linuxLevel/Exp`, `windowsLevel/Exp`, `role`, `tokenVersion`, `coins`, `equippedTitle/Theme/Cursor/Frame/Row` |
| `Mission` | โจทย์แต่ละด่าน | `os`, `level`, `expectedCommand`, `rewardExp` — unique(`os`,`level`) |
| `Progress` | สถานะรายด่านต่อผู้เล่น | `usedReveal` — unique(`userId`,`missionId`) |
| `PlayHistory` | บันทึกการเล่นแต่ละรอบ | `wpm`, `accuracy`, `earnedExp`, `earnedCoins` (nullable ทั้งคู่) |
| `UserItem` | ของที่ผู้เล่นซื้อไว้ | `itemId` — unique(`userId`,`itemId`) |
| `CommandDoc` | คู่มือคำสั่ง (หน้า Docs) | `os`, `category`, `command`, `example` |

> **แคตตาล็อกร้านค้าไม่ได้อยู่ใน DB** — อยู่ในโค้ดที่ [`src/shop/items.ts`](src/shop/items.ts) (ฉายา 24 · ธีม 6 · เอฟเฟกต์เมาส์ 12 · กรอบรูป 24 · เอฟเฟกต์แถว 12)
> `UserItem` เก็บแค่ `itemId` ราคาและประเภทอ่านจากโค้ดเสมอ → client แก้ราคาไม่ได้ และเพิ่มของใหม่ไม่ต้องแตะ DB

> **สตรีค (วันฝึกต่อเนื่อง) ไม่มีคอลัมน์ใน DB** — คิดสดจาก `PlayHistory` ทุกครั้งที่เรียก `/api/user/progress` ([`src/lib/streak.ts`](src/lib/streak.ts))
> ตัดวันตามเวลาไทย (UTC+7) เว้นได้ไม่เกิน 3 วัน เกินกว่านั้นรีเซ็ตเป็น 0 — วิธีนี้ไม่ต้องมี cron มารีเซ็ต และผู้เล่นเก่าได้สตรีคย้อนหลังตามประวัติจริง

---

## 🌐 API Endpoints

### Public (ไม่ต้อง login)
| Method | Path | หน้าที่ |
|---|---|---|
| `GET` | `/` | health check |
| `POST` | `/api/auth/google` | login ด้วย Google access_token → ตั้ง cookie |
| `GET` | `/api/mission/all` | รายชื่อด่านทั้งหมด (ไม่มีเฉลย) |
| `GET` | `/api/mission/:os/:level` | รายละเอียดด่าน + `sessionToken` (ไม่มีเฉลย) |
| `GET` | `/api/leaderboard/:os` | อันดับ (`linux` / `windows` / `combined`) |
| `GET` | `/api/docs/:os` | คู่มือคำสั่งของ OS นั้น |
| `GET` | `/api/user/profile/public/:username` | โปรไฟล์สาธารณะ |

### ต้อง Login (มี auth cookie)
| Method | Path | หน้าที่ |
|---|---|---|
| `POST` | `/api/auth/logout` | ออกจากระบบ (bump tokenVersion + ล้าง cookie) |
| `POST` | `/api/mission/verify` | ตรวจคำตอบ (ต้องส่ง `sessionToken`) → คืน `clearanceToken` + เฉลยเมื่อถูก |
| `POST` | `/api/mission/reveal` | ขอดูเฉลย (แลกกับ EXP 20%) |
| `GET` | `/api/user/progress` | โปรไฟล์/ความคืบหน้าของตัวเอง |
| `PUT` | `/api/user/profile` | แก้ไขโปรไฟล์ (displayName, avatar, bio) |
| `GET` | `/api/user/stats` | สถิติ + ประวัติล่าสุด (`recentLessons` มี `earnedExp`) |
| `GET` | `/api/user/history` | ประวัติการเล่นย้อนหลัง (สูงสุด 500 รายการ — ใช้กับปฏิทินหน้า History) |
| `PUT` | `/api/user/progress` | บันทึกผลเล่น + แจก EXP (ต้องส่ง `clearanceToken`) |
| `GET` | `/api/survival/start` | เริ่มโหมด Survival — คืนชุดโจทย์ + ตั๋วเริ่มเกม (`?os=linux\|windows`) |
| `POST` | `/api/survival/answer` | ส่งคำตอบทีละข้อ — server ตรวจ/นับแต้มเอง แล้วคืนตั๋วใบใหม่ |
| `POST` | `/api/survival/submit` | จบเกม — อ่านแต้มจากตั๋ว แจก EXP + เหรียญ |
| `GET` | `/api/shop` | ของในร้าน + เหรียญคงเหลือ + ของที่มี/ใส่อยู่ |
| `POST` | `/api/shop/buy` | ซื้อของ (ราคาอ่านจาก `src/shop/items.ts` ฝั่ง server) |
| `POST` | `/api/shop/equip` | ใส่ / ถอดของ (`?type=` เพื่อถอด) |

### Admin (ต้อง login + `role === 'admin'`)
| Method | Path | หน้าที่ |
|---|---|---|
| `GET` | `/api/admin/missions` | ดูโจทย์ทั้งหมด (มีเฉลย) |
| `POST` | `/api/admin/missions` | สร้างด่าน |
| `PUT` | `/api/admin/missions/swap` | สลับ `level` ของโจทย์ 2 ข้อ (ต้อง OS เดียวกัน) |
| `PUT` | `/api/admin/missions/reorder` | เรียงลำดับใหม่ทั้งหมวด — ส่ง `orderedIds` ครบทุกข้อของ OS นั้น แล้ว server ไล่เลข 1..N ให้ |
| `PUT` | `/api/admin/missions/:id` | แก้ไขด่าน (เนื้อหาเท่านั้น ไม่รวม `level`) |
| `DELETE` | `/api/admin/missions/:id` | ลบด่าน |

> ⚠️ `swap` / `reorder` ต้องประกาศ **ก่อน** `/missions/:id` ใน [`src/routes/admin.ts`](src/routes/admin.ts) ไม่งั้น Hono จะจับเป็น `id = "swap"`
> และทั้งคู่ต้องพักค่าไว้ที่ **เลขติดลบ** ก่อนวางเลขจริง เพราะ `@@unique([os, level])` จะชนทันทีถ้า UPDATE สลับกันตรงๆ
| `PUT` | `/api/admin/favorites` | toggle favorite ด่าน |
| `POST` | `/api/admin/docs` | สร้างคู่มือคำสั่ง |
| `PUT` | `/api/admin/docs/:id` | แก้ไขคู่มือ |
| `DELETE` | `/api/admin/docs/:id` | ลบคู่มือ |

### Seed (ต้องมี header `X-Seed-Secret` ตรงกับ `SEED_PASSWORD`)
| Method | Path | หน้าที่ |
|---|---|---|
| `GET` | `/api/seed` | เพิ่มข้อมูลด่านเริ่มต้น (34 ด่าน) |
| `GET` | `/api/seed/docs` | เพิ่มข้อมูลคู่มือคำสั่ง (100 รายการ) |

---

## ⚙️ Environment Variables & Secrets

| ชื่อ | ประเภท | ตั้งค่าที่ |
|---|---|---|
| `GOOGLE_CLIENT_ID` | var (public) | `wrangler.jsonc` → `vars` |
| `JWT_SECRET` | **secret** | `wrangler secret put JWT_SECRET` |
| `SEED_PASSWORD` | **secret** | `wrangler secret put SEED_PASSWORD` |
| `DB` | D1 binding | `wrangler.jsonc` → `d1_databases` |

สำหรับรัน local สร้างไฟล์ **`.dev.vars`** (อย่า commit):
```
JWT_SECRET=your-long-random-secret
SEED_PASSWORD=your-seed-password
```

---

## 🚀 การติดตั้งและรัน

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. generate Prisma client
npx prisma generate

# 3. สร้างตาราง + คอลัมน์ใน D1 (local)
npx wrangler d1 migrations apply keyrush-db --local

# 4. รัน dev server
npm run dev

# 5. (ครั้งแรก) เพิ่มข้อมูลด่าน — ยิงพร้อม header X-Seed-Secret
#    GET http://localhost:8787/api/seed
#    GET http://localhost:8787/api/seed/docs
```

### Deploy ขึ้น Production
```bash
# ตั้ง secret (ทำครั้งเดียว)
npx wrangler secret put JWT_SECRET
npx wrangler secret put SEED_PASSWORD

# apply migration บน D1 production
npx wrangler d1 migrations apply keyrush-db --remote

# deploy
npm run deploy
```

---

## 🗂️ Database Migrations

โฟลเดอร์ [`migrations/`](migrations/) คือ migration ของ Cloudflare D1 (รันด้วย `wrangler d1 migrations apply`):

| ไฟล์ | เนื้อหา |
|---|---|
| `0001_init_schema.sql` | สร้างตารางทั้งหมด (User, Mission, Progress, PlayHistory, CommandDoc) |
| `0002_add_token_version.sql` | เพิ่ม `User.tokenVersion` (revocation) |
| `0003_add_used_reveal.sql` | เพิ่ม `Progress.usedReveal` (โทษดูเฉลย) |
| `0004_add_earned_exp_history.sql` | เพิ่ม `PlayHistory.earnedExp` (EXP ต่อรอบ) |
| `0005_add_shop_system.sql` | เพิ่มระบบร้านค้า — `User.coins`, `User.equippedTitle`, ตาราง `UserItem` |
| `0006_add_equipped_theme.sql` | เพิ่ม `User.equippedTheme` (ธีมเว็บ) |
| `0007_add_equipped_cursor.sql` | เพิ่ม `User.equippedCursor` (เอฟเฟกต์เมาส์) |
| `0008_add_earned_coins_history.sql` | เพิ่ม `PlayHistory.earnedCoins` (เหรียญต่อรอบ) |
| `0009_add_useritem_view.sql` | view ช่วยอ่านของที่ผู้เล่นมี |
| `0010_add_equipped_frame.sql` | เพิ่ม `User.equippedFrame` (กรอบรูปโปรไฟล์) |
| `0011_add_equipped_row.sql` | เพิ่ม `User.equippedRow` (เอฟเฟกต์แถว Leaderboard) |

> โฟลเดอร์ `prisma/migrations/` เป็นของ Prisma แยกต่างหาก — สำหรับ D1 ให้ยึด `migrations/` เป็นหลัก

---

## 📁 โครงสร้างโปรเจกต์

```
src/
├── index.ts              # entry point + middleware chain (CORS, headers, rate limit, CSRF)
├── middlewares/
│   ├── auth.ts           # authenticateToken (+tokenVersion check), authorizeAdmin
│   ├── csrf.ts           # CSRF double-submit protection
│   └── rateLimit.ts      # rate limiter 30/นาที/IP (survival/answer แยกเป็น 90)
├── lib/
│   ├── answerCheck.ts    # กติกาตรวจคำตอบ (ไม่สนตัวพิมพ์) — ต้องตรงกับฝั่งหน้าเว็บ
│   ├── streak.ts         # คิดสตรีควันฝึกต่อเนื่องจาก PlayHistory (เวลาไทย, เว้นได้ 3 วัน)
│   └── profanity.ts      # กรองคำหยาบใน displayName / bio
├── shop/
│   └── items.ts          # แคตตาล็อกสินค้า (ราคา/ประเภทอยู่ในโค้ด ไม่อยู่ DB)
└── routes/
    ├── auth.ts           # Google login, logout
    ├── user.ts           # progress (+streak), profile, stats, history
    ├── mission.ts        # get mission, verify, reveal
    ├── survival.ts       # โหมด Survival (rolling token)
    ├── shop.ts           # ร้านค้า — ดูของ, ซื้อ, ใส่/ถอด
    ├── leaderboard.ts    # จัดอันดับ
    ├── admin.ts          # จัดการด่าน + สลับ/เรียงลำดับ (admin)
    ├── docs.ts           # อ่านคู่มือคำสั่ง
    ├── adminDocs.ts      # จัดการคู่มือ (admin)
    └── seed.ts           # เพิ่มข้อมูลเริ่มต้น
```

---

## 🛣️ Roadmap (แผนพัฒนาถัดไป)

- [ ] ย้าย backend ไป subdomain เดียวกับ frontend (`api.keyrush.xxx`) → รองรับ Safari/iOS (แก้ปัญหา third-party cookie) + ลด cookie เหลือ `SameSite=Lax`
- [ ] อัปเกรด Google login เป็น **Authorization Code Flow** (ทำพร้อมตอนย้าย domain)
- [ ] Rate limiter แบบ persistent ด้วย Durable Objects (ปัจจุบันเก็บใน memory ต่อ isolate — แต่ละ isolate มีสมุดจดของตัวเองและถูกรีไซเคิลตลอด ของจริงจึงหลวมกว่าตัวเลขที่ตั้งไว้)
- [ ] ถ้าผู้เล่นมี `PlayHistory` หลักหมื่นแถวแล้วเริ่มช้า ค่อยย้ายสตรีคไปเก็บเป็นคอลัมน์ `streak` + `lastPlayedAt` แทนการคิดสดทุก request
