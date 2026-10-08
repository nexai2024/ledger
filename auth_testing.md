# LedgerSync Auth Testing Playbook

Auth is JWT email/password (cookies: access_token, refresh_token) + Emergent Google OAuth
(session_token cookie). Unified `get_current_founder` reads access_token, then session_token,
then Authorization: Bearer.

## Admin / Founder account
- Email: nexai.coach@gmail.com
- Password: LedgerSync2026!

## Endpoints (all under /api)
- POST /api/auth/register {email,password,name,companyName}
- POST /api/auth/login {email,password}
- POST /api/auth/logout
- GET  /api/auth/me
- POST /api/auth/refresh
- POST /api/auth/forgot-password {email}
- POST /api/auth/reset-password {token,password}
- POST /api/auth/google/session   (header X-Session-ID, sets session_token cookie)

## API smoke
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"nexai.coach@gmail.com","password":"LedgerSync2026!"}'
curl -b cookies.txt http://localhost:8001/api/auth/me

## Password reset (local token capture)
Set FRONTEND_URL="http://localhost:3000" in backend/.env, restart backend, trigger
forgot-password, read link from backend log, then restore the https origin and restart.

## Google OAuth session (browser testing)
Create user + user_sessions row, set session_token cookie (httpOnly, secure, sameSite=None),
then navigate to /dashboard.
