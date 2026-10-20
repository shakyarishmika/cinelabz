// src/app/api/sub/route.js
// Small proxy so the player can read ANY subtitle link (no CORS problems) and
// so the "Download subtitle" button really downloads the file.
//
//   GET /api/sub?url=<subtitle link>                       -> subtitle text (for the player)
//   GET /api/sub?url=<subtitle link>&download=1&name=Title -> file download
import dns from "node:dns/promises";
import net from "node:net";

// (No `runtime` export: Node.js is the default, and Next 16 "cacheComponents" does not allow it.)

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

// ---------- WebVTT -> SRT (some old devices can't read .vtt) ----------
const pad2 = (n, l = 2) => String(n).padStart(l, "0");
function toSecs(t) {
  const m = t.trim().match(/^(?:(\d+):)?(\d+):(\d+)[.,](\d{1,3})/);
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(`0.${m[4]}`);
}
function fmtSrt(sec) {
  const total = Math.max(0, Math.round(sec * 1000));
  return `${pad2(Math.floor(total / 3600000))}:${pad2(Math.floor((total % 3600000) / 60000))}:${pad2(Math.floor((total % 60000) / 1000))},${pad2(total % 1000, 3)}`;
}
const COLOR_NAMES = new Set(["white", "lime", "cyan", "red", "yellow", "magenta", "blue", "black", "orange", "pink", "gray", "grey", "green", "purple"]);
// <c.yellow>..</c> -> <font color="yellow">..</font>; keep <i> <b> <u>; drop everything else
function srtText(text) {
  return text.replace(/\{\\[^}]*\}/g, "").replace(/<(\/?)\s*([a-z0-9]+)([^>]*)>/gi, (m, slash, tag, rest) => {
    tag = tag.toLowerCase();
    if (tag === "i" || tag === "b" || tag === "u") return `<${slash}${tag}>`;
    if (tag === "c") {
      if (slash) return "</font>";
      const color = rest.split(".").map((x) => x.trim().toLowerCase()).find((x) => COLOR_NAMES.has(x));
      return color ? `<font color="${color}">` : "<font>";
    }
    if (tag === "font") return slash ? "</font>" : m;
    return "";
  });
}
const isVtt = (t) => /^\uFEFF?\s*WEBVTT/.test(t);
function vttToSrt(vtt) {
  const out = [];
  let n = 0;
  for (const block of vtt.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n");
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, b] = lines[i].split("-->");
    const body = srtText(lines.slice(i + 1).join("\n")).trim();
    if (!body) continue;
    out.push(`${++n}\n${fmtSrt(toSecs(a))} --> ${fmtSrt(toSecs(b.trim().split(/\s+/)[0]))}\n${body}\n`);
  }
  return out.join("\n");
}

// ---------- tiny ZIP writer (one file, no compression) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function makeZip(name, data) {
  const nameBuf = Buffer.from(name, "utf8");
  const crc = crc32(data);
  const d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 file name
  local.writeUInt16LE(0, 8); // stored
  local.writeUInt16LE(dosTime, 10);
  local.writeUInt16LE(dosDate, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(dosTime, 12);
  central.writeUInt16LE(dosDate, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);

  const localPart = Buffer.concat([local, nameBuf, data]);
  const centralPart = Buffer.concat([central, nameBuf]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralPart.length, 12);
  end.writeUInt32LE(localPart.length, 16);
  return Buffer.concat([localPart, centralPart, end]);
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
    // Always delivered as a .zip. A ready-made .zip link is passed through;
    // anything else becomes <name>.srt (UTF-8) inside a zip. .vtt is converted to .srt first.
    const base = (searchParams.get("name") || "subtitle").replace(/[^\w .()-]/g, "_").trim().slice(0, 80) || "subtitle";
    let out;
    if (file.buf[0] === 0x50 && file.buf[1] === 0x4b) {
      out = file.buf;
    } else {
      let text = decode(file.buf);
      if (isVtt(text)) text = vttToSrt(text);
      const srt = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text.replace(/\r?\n/g, "\r\n"), "utf8")]);
      out = makeZip(`${base}.srt`, srt);
    }
    return new Response(out, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${base}.zip"`,
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