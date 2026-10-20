// src/app/api/stream/route.js
// Signed, expiring video links. The page never puts your real video/Telegram-stream URL
// in the HTML or network tab — only a token that is useless after a few minutes or on another site.
//
//   GET  /api/stream?t=<token>              -> redirects to the real video (used by the player)
//   POST /api/stream  { url }               -> makes a token for a given url (called by the browser)
//
// Needs: STREAM_SIGNING_SECRET  env var (any long random string — set once, never share it)
import crypto from "node:crypto";

const SECRET = process.env.STREAM_SIGNING_SECRET || "";
const TTL_MS = 6 * 60 * 1000; // a token is usable for 6 minutes after it's made

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verify(token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!payload.url || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function POST(req) {
  if (!SECRET) return Response.json({ error: "STREAM_SIGNING_SECRET is not set" }, { status: 500 });
  const { url } = await req.json().catch(() => ({}));
  if (!url || !/^https?:\/\//i.test(url)) return Response.json({ error: "bad url" }, { status: 400 });
  const token = sign({ url, exp: Date.now() + TTL_MS });
  return Response.json({ src: `/api/stream?t=${token}` });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const payload = verify(searchParams.get("t"));
  if (!payload) return new Response("This link has expired. Reload the page.", { status: 410 });

  const range = req.headers.get("range");
  const upstream = await fetch(payload.url, { headers: range ? { Range: range } : {} });
  if (!upstream.ok && upstream.status !== 206) return new Response("Upstream error", { status: 502 });

  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("Cache-Control", "no-store"); // never cached/shared — it dies with the token
  return new Response(upstream.body, { status: upstream.status, headers });
}