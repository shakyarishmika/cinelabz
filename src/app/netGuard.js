// src/app/netGuard.js  (SERVER ONLY) : fetch a URL only if it is a PUBLIC http(s) address
// (blocks localhost / private networks, and checks every redirect hop).
import net from "node:net";

export function isPrivateIp(ip) {
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

export async function assertPublicUrl(urlStr) {
  const u = new URL(urlStr);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http/https links are allowed");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("That address is not allowed");
    return;
  }
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("That address is not allowed");
  try {
    const dns = await import("node:dns/promises"); // not available on every host (e.g. Cloudflare Workers): then skipped
    const addrs = await dns.lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("That address is not allowed");
  } catch (e) {
    if (e?.message === "That address is not allowed") throw e;
  }
}

// fetch() that follows redirects by hand so every hop is checked. Returns { res, url } (url = final address)
export async function fetchPublic(startUrl, init = {}, maxRedirects = 3) {
  let url = startUrl;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(url);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000); // waiting for the first bytes
    let res;
    try {
      res = await fetch(url, { ...init, redirect: "manual", signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location"), url).toString();
      continue;
    }
    return { res, url };
  }
  throw new Error("Too many redirects");
}
