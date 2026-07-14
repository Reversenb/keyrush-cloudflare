import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'

// ==========================================
// 🛡️ CSRF Protection (double-submit cookie)
// frontend ต้องอ่านค่า cookie 'csrf_token' แล้วแนบมาเป็น header 'X-CSRF-Token'
// ==========================================
const UNSAFE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH']
const SKIP_PATHS = ['/api/auth/google']

export const csrfProtection = async (c: Context, next: Next) => {
  if (!UNSAFE_METHODS.includes(c.req.method)) return next()
  if (SKIP_PATHS.includes(c.req.path)) return next()

  // บังคับเช็คเฉพาะ request ที่พก auth cookie มา —
  // request ที่ไม่มี cookie (เช่น curl + Bearer header หรือ /api/seed) ไม่มี ambient credential ให้ CSRF โจมตี
  if (!getCookie(c, 'auth_token')) return next()

  const cookieToken = getCookie(c, 'csrf_token')
  const headerToken = c.req.header('X-CSRF-Token')

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return c.json({ success: false, message: 'CSRF token ไม่ถูกต้องหรือขาดหายไป' }, 403)
  }
  await next()
}
