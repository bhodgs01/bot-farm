/**
 * Same-origin password gate for the Bot Farm.
 *
 * Cloudflare Access redirects unauthenticated requests to a different domain, which a
 * data-driven page can't follow (the fetches and the web manifest die on CORS). This gate
 * lives on the app itself: one shared password, checked here, that sets a signed cookie on
 * this origin. No redirects, no CORS. The password is a secret (BOTFARM_PASSWORD), never in
 * git; the cookie is HMAC-signed with it so it can't be forged.
 *
 * Only the public map host is gated (BOTFARM_AUTH_HOSTS). The news hostname and in-cluster
 * localhost calls are never gated. If no password is configured the gate is OFF (fail open),
 * so a missing secret never locks Blake out — it just leaves the map as open as it was before.
 */
import crypto from 'node:crypto'

const PASSWORD = process.env.BOTFARM_PASSWORD || ''
const AUTH_HOSTS = (process.env.BOTFARM_AUTH_HOSTS || 'bot-farm.kcproto.com').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
const COOKIE = 'bf_auth'
const DAYS = 30
const MAXAGE = DAYS * 86400

export const authEnabled = () => Boolean(PASSWORD)

/** Only the public map host(s) are gated; news and localhost are not. */
export function needsAuth(host) {
  if (!PASSWORD) return false
  const h = String(host || '').split(':')[0].toLowerCase()
  return AUTH_HOSTS.includes(h)
}

function sign(expiry) {
  return crypto.createHmac('sha256', PASSWORD).update(String(expiry)).digest('base64url')
}

function eq(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

/** True if the request carries a valid, unexpired auth cookie. */
export function hasValidAuth(req) {
  if (!PASSWORD) return true
  const raw = String(req.headers.cookie || '')
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))
  if (!m) return false
  const [expiry, sig] = decodeURIComponent(m[1]).split('.')
  if (!expiry || !sig || Number(expiry) < Date.now()) return false
  return eq(sig, sign(expiry))
}

export function checkPassword(pw) {
  return Boolean(PASSWORD) && eq(pw, PASSWORD)
}

export function makeSetCookie() {
  const expiry = Date.now() + DAYS * 86400000
  const val = `${expiry}.${sign(expiry)}`
  return `${COOKIE}=${encodeURIComponent(val)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAXAGE}`
}

/** A small, self-contained login page — no external assets, so it works before auth. */
export function loginPage({ error = false } = {}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Bot Farm</title><style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;height:100vh;display:grid;place-items:center;background:radial-gradient(1200px 800px at 50% -10%, #1b2233, #0c0f17 60%);color:#e6e8ef;font:16px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif}
  form{width:min(92vw,340px);background:rgba(18,22,33,.9);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:26px 24px;box-shadow:0 20px 60px rgba(0,0,0,.5);display:grid;gap:14px}
  h1{margin:0 0 2px;font-size:19px;font-weight:650;letter-spacing:.2px}
  p{margin:0;color:#98a2c0;font-size:13.5px}
  input{width:100%;padding:12px 13px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0e1220;color:#fff;font-size:15px}
  input:focus{outline:none;border-color:#4f7cff}
  button{width:100%;padding:12px;border:0;border-radius:10px;background:#4f7cff;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
  button:hover{background:#5f88ff}
  .err{color:#ff8a8a;font-size:13px;min-height:16px}
</style></head><body>
  <form id="f">
    <h1>Bot Farm</h1>
    <p>Enter the password to view the colony.</p>
    <input id="pw" type="password" autocomplete="current-password" placeholder="Password" autofocus>
    <div class="err" id="e">${error ? 'Wrong password. Try again.' : ''}</div>
    <button type="submit">Enter</button>
  </form>
  <script>
    const f=document.getElementById('f'),pw=document.getElementById('pw'),e=document.getElementById('e');
    f.addEventListener('submit',async(ev)=>{ev.preventDefault();e.textContent='';
      try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw.value})});
        if(r.ok){location.replace('/');}else{e.textContent='Wrong password. Try again.';pw.value='';pw.focus();}
      }catch(_){e.textContent='Could not reach the server. Try again.';}
    });
  </script>
</body></html>`
}
