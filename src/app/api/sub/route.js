// src/app/api/sub/route.js
// Small proxy so the player can read ANY subtitle link (no CORS problems) and
// so the "Download subtitle" button really downloads the file.
//
//   GET /api/sub?url=<subtitle link>                       -> subtitle text (for the player)
//   GET /api/sub?url=<subtitle link>&download=1&name=Title -> file download
import dns from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024; // subtitle files are small
const MAX_REDIRECTS = 3;

// Make common "share" links work as direct links
function normalize(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const drive = u.hostname === "drive.google.com" && u.pathname.match(/\/file\/d\/([^/]+)/);
  if (drive) return `https://drive.google.com/uc?export=download&id=${drive[1]}`;
  if (u.hostname === "github.com") {
    const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
    if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
  }
  return u.toString();
}

function isPrivateIp(ip) {
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
}

// Only public http(s) hosts (blocks localhost / internal network addresses)
async function assertPublic(urlStr) {
  const u = new URL(urlStr);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http/https links are allowed");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("That address is not allowed");
}

async function fetchLimited(startUrl) {
  let url = startUrl;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await assertPublic(url);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    let res;
    try {
      res = await fetch(url, { redirect: "manual", signal: ctrl.signal, headers: { "User-Agent": "CineLabz-subtitle-proxy" } });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location"), url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`Link returned ${res.status}`);

    const chunks = [];
    let total = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) {
        reader.cancel();
        throw new Error("File is too big for a subtitle");
      }
      chunks.push(value);
    }
    return { buf: Buffer.concat(chunks), type: res.headers.get("content-type") || "" };
  }
  throw new Error("Too many redirects");
}

function decode(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

const bad = (msg, status = 400) => new Response(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const target = normalize(searchParams.get("url") || "");
  if (!target) return bad("Missing or invalid url");

  let file;
  try {
    file = await fetchLimited(target);
  } catch (e) {
    return bad(e.message || "Couldn't fetch the subtitle", 502);
  }

  const head = file.buf.subarray(0, 200).toString("utf8").trimStart().toLowerCase();
  if (file.type.includes("text/html") || head.startsWith("<!doctype html") || head.startsWith("<html")) {
    return bad("That link is a web page, not a subtitle file. Use a direct link to the .srt / .vtt file.", 415);
  }

  if (searchParams.get("download")) {
    const ext = (target.split("?")[0].match(/\.(srt|vtt|ass|ssa|sub)$/i) || [".srt"])[0].toLowerCase();
    const base = (searchParams.get("name") || "subtitle").replace(/[^\w .()-]/g, "_").slice(0, 80);
    return new Response(file.buf, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${base}${ext}"`,
        "Cache-Control": "public, s-maxage=3600",
      },
    });
  }

  return new Response(decode(file.buf), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
