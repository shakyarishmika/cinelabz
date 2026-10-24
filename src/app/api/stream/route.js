// src/app/api/stream/route.js
// Hides the real video link from the page source (the page only contains a signed token).
//
//   POST /api/stream { url }      -> { src: "/api/stream?t=<token>" }
//   GET  /api/stream?t=<token>    -> 302 redirect to the real video
//
// IMPORTANT: this does NOT carry the video bytes. An earlier version streamed the whole video
// through a serverless function, which got cut off after about a minute. Now the browser downloads
// the video directly from its host. (So the real link can still be seen in the browser's Network tab.)
//
// Needs: STREAM_SIGNING_SECRET env var (any long random string)
import crypto from "node:crypto";

const SECRET = process.env.STREAM_SIGNING_SECRET || "";
const TTL_MS = 12 * 60 * 60 * 1000; // a token works for 12 hours (long enough for one viewing session)

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
  return Response.json({ src: `/api/stream?t=${sign({ url, exp: Date.now() + TTL_MS })}` });
}

export async function GET(req) {
  const payload = verify(new URL(req.url).searchParams.get("t"));
  if (!payload) return new Response("This link has expired. Reload the page.", { status: 410 });
  return new Response(null, { status: 302, headers: { Location: payload.url, "Cache-Control": "no-store" } });
}