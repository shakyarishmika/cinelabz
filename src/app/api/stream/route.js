// src/app/api/stream/route.js
//   POST /api/stream { url }                 -> { src: "/api/stream?t=<token>" }      (hides the real link in the page)
//   POST /api/stream { url, proxy: true }    -> { src: "/api/proxy?t=<token>" }       (video goes through /api/proxy)
//   GET  /api/stream?t=<token>               -> 302 redirect to the real video
//
// The redirect mode does NOT carry the video bytes (the browser downloads straight from the host).
// Proxy mode is only for links that fail with CORS errors, and only for hosts you list in PROXY_ALLOWED_HOSTS.
//
// Env: STREAM_SIGNING_SECRET (long random string)
//      PROXY_ALLOWED_HOSTS   (comma list, e.g.  cdn.example.com,*.mystorage.net)
import { hasSecret, sign, verify } from "../../streamToken";

const hostAllowed = (host) =>
  (process.env.PROXY_ALLOWED_HOSTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((p) => (p.startsWith("*.") ? host.endsWith(p.slice(1)) : host === p));

export async function POST(req) {
  if (!hasSecret()) return Response.json({ error: "STREAM_SIGNING_SECRET is not set" }, { status: 500 });
  const { url, proxy } = await req.json().catch(() => ({}));
  if (!url || !/^https?:\/\//i.test(url)) return Response.json({ error: "bad url" }, { status: 400 });

  if (proxy) {
    // only our own website may ask for a proxy link
    const origin = req.headers.get("origin");
    if (origin) {
      try {
        if (new URL(origin).host !== new URL(req.url).host) return Response.json({ error: "forbidden" }, { status: 403 });
      } catch {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
    }
    let host;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      return Response.json({ error: "bad url" }, { status: 400 });
    }
    if (!process.env.PROXY_ALLOWED_HOSTS) return Response.json({ error: "PROXY_ALLOWED_HOSTS is not set" }, { status: 500 });
    if (!hostAllowed(host)) return Response.json({ error: `${host} is not in PROXY_ALLOWED_HOSTS` }, { status: 403 });
    return Response.json({ src: `/api/proxy?t=${sign({ url, k: "p" })}` });
  }

  return Response.json({ src: `/api/stream?t=${sign({ url, k: "r" })}` });
}

export async function GET(req) {
  const payload = verify(new URL(req.url).searchParams.get("t"), "r");
  if (!payload) return new Response("This link has expired. Reload the page.", { status: 410 });
  return new Response(null, { status: 302, headers: { Location: payload.url, "Cache-Control": "no-store" } });
}