// src/app/api/proxy/route.js
// "Continuous" streaming proxy for links that fail with CORS errors.
//
//  * Video files (mp4 ...): every request is answered in pieces of at most CHUNK bytes. The browser just keeps
//    asking for the next piece, so playback never hits a serverless time limit (that is what cut a single long
//    stream after about a minute).
//  * HLS (.m3u8): the playlist is rewritten so every segment / key / sub-playlist also comes through this proxy.
//
// Only links signed by /api/stream (host allow-list: PROXY_ALLOWED_HOSTS) can be fetched, so it is not an open proxy.
// NOTE: all video bytes pass through your hosting, which uses its bandwidth.
import { sign, verify } from "../../streamToken";
import { fetchPublic } from "../../netGuard";

const CHUNK = 8 * 1024 * 1024; // 8 MiB per piece
const PASS = ["content-type", "content-length", "content-range", "etag", "last-modified"];

const text = (msg, status) => new Response(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
const proxied = (url) => `/api/proxy?t=${sign({ url, k: "p" })}`;

// every URL inside an HLS playlist -> goes through this proxy again
function rewritePlaylist(body, baseUrl) {
  return body
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (m, u) => (u.startsWith("data:") ? m : `URI="${proxied(new URL(u, baseUrl).toString())}"`));
      }
      return proxied(new URL(t, baseUrl).toString());
    })
    .join("\n");
}

// serve bytes [skip, skip + take) of a stream (used when the server ignores Range requests)
function sliceStream(body, skip, take) {
  const reader = body.getReader();
  let seen = 0;
  let sent = 0;
  return new ReadableStream({
    async pull(ctrl) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return ctrl.close();
        let chunk = value;
        if (seen < skip) {
          const drop = Math.min(skip - seen, chunk.length);
          chunk = chunk.subarray(drop);
          seen += drop;
          if (!chunk.length) continue;
        }
        const room = take - sent;
        if (chunk.length >= room) {
          ctrl.enqueue(chunk.subarray(0, room));
          ctrl.close();
          reader.cancel().catch(() => {});
          return;
        }
        ctrl.enqueue(chunk);
        sent += chunk.length;
        return;
      }
    },
    cancel() {
      return reader.cancel().catch(() => {});
    },
  });
}

export async function GET(req) {
  const payload = verify(new URL(req.url).searchParams.get("t"), "p");
  if (!payload) return text("This link has expired. Reload the page.", 410);

  // work out which piece the browser wants
  const rangeHeader = req.headers.get("range");
  let start = 0;
  let rangeEnd = 0;
  let forward = null; // Range header we send upstream
  let suffix = false; // "bytes=-N" (last N bytes): passed through as it is
  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (m && m[1] !== "") {
      start = Number(m[1]);
      rangeEnd = Math.min(m[2] !== "" ? Number(m[2]) : Infinity, start + CHUNK - 1);
      forward = `bytes=${start}-${rangeEnd}`;
    } else if (m) {
      forward = rangeHeader.trim();
      suffix = true;
    }
  }

  let upstream;
  let finalUrl;
  try {
    ({ res: upstream, url: finalUrl } = await fetchPublic(payload.url, {
      headers: { ...(forward ? { Range: forward } : {}), "User-Agent": "Mozilla/5.0 (compatible; CineLabz-proxy)" },
    }));
  } catch (e) {
    return text(e?.message || "Couldn't reach the video", 502);
  }
  if (upstream.status >= 400 && upstream.status !== 416) return text(`The video server answered ${upstream.status}`, 502);

  // HLS playlist -> rewrite
  const ct = upstream.headers.get("content-type") || "";
  if (/mpegurl/i.test(ct) || /\.m3u8(\?|#|$)/i.test(finalUrl)) {
    const body = await upstream.text();
    if (body.trimStart().startsWith("#EXTM3U")) {
      return new Response(rewritePlaylist(body, finalUrl), {
        status: 200,
        headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" },
      });
    }
    return new Response(body, { status: 200, headers: { "Content-Type": ct || "text/plain" } });
  }

  const headers = new Headers({ "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" });
  for (const h of PASS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }

  if (upstream.status === 206) return new Response(upstream.body, { status: 206, headers });
  if (upstream.status === 416) return new Response(null, { status: 416, headers });

  // the video server ignored our Range request (answered 200 with everything): cut the piece ourselves
  if (forward && !suffix) {
    const total = Number(upstream.headers.get("content-length")) || 0;
    if (total && start >= total) {
      headers.set("Content-Range", `bytes */${total}`);
      return new Response(null, { status: 416, headers });
    }
    const last = total ? Math.min(rangeEnd, total - 1) : rangeEnd;
    const take = last - start + 1;
    headers.set("Content-Range", `bytes ${start}-${last}/${total || "*"}`);
    if (total) headers.set("Content-Length", String(take));
    else headers.delete("content-length");
    return new Response(sliceStream(upstream.body, start, take), { status: 206, headers });
  }
  return new Response(upstream.body, { status: 200, headers });
}
