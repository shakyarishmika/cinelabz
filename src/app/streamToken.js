// src/app/streamToken.js  (SERVER ONLY) : signed, expiring tokens shared by /api/stream and /api/proxy
// Needs: STREAM_SIGNING_SECRET env var (any long random string)
//   kind "r" = redirect token (/api/stream)      kind "p" = proxy token (/api/proxy)
import crypto from "node:crypto";

const SECRET = process.env.STREAM_SIGNING_SECRET || "";
const DEFAULT_TTL = 12 * 60 * 60 * 1000; // 12 hours

export const hasSecret = () => !!SECRET;

export function sign(payload, ttlMs = DEFAULT_TTL) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verify(token, kind = "r") {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig || !SECRET) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!payload.url || !payload.exp || Date.now() > payload.exp) return null;
    if ((payload.k || "r") !== kind) return null; // a redirect token can never be used as a proxy token
    return payload;
  } catch {
    return null;
  }
}
