"use client";

// src/app/AdvancedPlayer.js
// CineLabz custom player (works in Chrome, Edge, Safari, Firefox, iPhone, Android)
//  - own controls: play/pause, ±10s, seek bar, volume, subtitles on/off, settings, PiP, fullscreen
//  - subtitles are drawn by the player itself (no background box by default),
//    with size / delay / position / background settings built into the player
//  - no native browser controls => no built-in "Download" menu
//  - mobile: tap to show/hide controls, double-tap left/right to skip 10s,
//    fullscreen fallback for iPhone
//  - remembers where you stopped + your subtitle settings
//  - HLS (.m3u8) support with a Quality menu inside the player (needs: npm install hls.js)
//  - if the connection drops it reloads the video at the same spot instead of stopping

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------- subtitles
const pad = (n, l = 2) => String(n).padStart(l, "0");

function toSeconds(t) {
  const m = t.trim().match(/^(?:(\d+):)?(\d+):(\d+)[.,](\d{1,3})/);
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(`0.${m[4]}`);
}

// SRT / VTT text -> [{ start, end, text }]
function parseCues(raw) {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r/g, "");
  const cues = [];
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split("\n");
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, b] = lines[i].split("-->");
    const body = lines.slice(i + 1).join("\n").trim();
    if (!body) continue;
    cues.push({ start: toSeconds(a), end: toSeconds(b.trim().split(/\s+/)[0]), text: body });
  }
  return cues.sort((x, y) => x.start - y.start);
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// colours allowed in subtitles: WebVTT names + a few common ones + #hex
const COLOR_NAMES = new Set(["white", "lime", "cyan", "red", "yellow", "magenta", "blue", "black", "orange", "pink", "gray", "grey", "green", "purple"]);
const colorOf = (c) => {
  const x = (c || "").trim().toLowerCase();
  return COLOR_NAMES.has(x) || /^#[0-9a-f]{3,8}$/.test(x) ? x : null;
};

// Subtitle text -> safe HTML.
// Supports <i> <b> <u>, WebVTT colours <c.yellow>..</c> (also <c.yellow.bg_black>),
// SRT <font color="#ff0">..</font>. Every other tag is removed, all text is escaped.
function cueHtml(text) {
  const s = text.replace(/\{\\[^}]*\}/g, "");
  let out = "";
  for (const part of s.split(/(<[^>]*>)/)) {
    if (!part) continue;
    if (part[0] !== "<") {
      out += esc(part);
      continue;
    }
    const m = part.match(/^<\s*(\/?)\s*([a-z0-9]+)([^>]*)>$/i);
    if (!m) continue;
    const close = !!m[1];
    const tag = m[2].toLowerCase();
    const rest = m[3];
    if (tag === "i" || tag === "b" || tag === "u") out += close ? `</${tag}>` : `<${tag}>`;
    else if (tag === "c") {
      if (close) out += "</span>";
      else {
        let fg = null;
        let bg = null;
        rest.split(".").forEach((cls) => {
          cls = cls.trim().toLowerCase();
          if (cls.startsWith("bg_")) bg = bg || colorOf(cls.slice(3));
          else fg = fg || colorOf(cls);
        });
        out += `<span style="${fg ? `color:${fg};` : ""}${bg ? `background:${bg};padding:0 .2em;` : ""}">`;
      }
    } else if (tag === "font") {
      if (close) out += "</span>";
      else {
        const c = rest.match(/color\s*=\s*["']?([#a-z0-9]+)/i);
        const fg = c ? colorOf(c[1]) : null;
        out += `<span style="${fg ? `color:${fg};` : ""}">`;
      }
    }
    // everything else (<v Name>, <lang>, <00:00:01.000> ...) is dropped
  }
  return out.replace(/\n/g, "<br/>");
}

// indexes of the cues visible at time t (cues sorted by start)
function findActive(cues, t) {
  let lo = 0;
  let hi = cues.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) {
      idx = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  const out = [];
  for (let i = idx; i >= 0 && i > idx - 8; i--) if (cues[i].end > t) out.unshift(i);
  return out;
}

const fmt = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
};

// ---------------------------------------------------------------- icons
const Icon = ({ children, className = "w-6 h-6" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    {children}
  </svg>
);
const IPlay = (p) => <Icon {...p}><path d="M8 5v14l11-7z" /></Icon>;
const IPause = (p) => <Icon {...p}><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></Icon>;
const IVol = (p) => <Icon {...p}><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></Icon>;
const IMute = (p) => <Icon {...p}><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></Icon>;
const ICC = (p) => <Icon {...p}><path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z" /></Icon>;
const IGear = (p) => <Icon {...p}><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" /></Icon>;
const IPip = (p) => <Icon {...p}><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z" /></Icon>;
const IFs = (p) => <Icon {...p}><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></Icon>;
const IFsExit = (p) => <Icon {...p}><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></Icon>;
const IClose = (p) => <Icon {...p}><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></Icon>;
const ISkip = ({ dir, className = "w-7 h-7" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    {dir === "back" ? (
      <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
    ) : (
      <g transform="translate(24 0) scale(-1 1)">
        <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
      </g>
    )}
    <text x="12" y="16.3" textAnchor="middle" fontSize="7" fontWeight="800" fill="currentColor" style={{ fontFamily: "system-ui, sans-serif" }}>
      10
    </text>
  </svg>
);
const Spinner = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 24 24" className={`${className} animate-spin`} fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// ---------------------------------------------------------------- small UI pieces
const Step = ({ onClick, disabled, children, wide }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`${wide ? "flex-1" : "min-w-9"} h-9 px-2.5 rounded-lg bg-white/10 hover:bg-red-600 active:scale-95 text-xs font-bold transition disabled:opacity-40 disabled:hover:bg-white/10 cursor-pointer`}
  >
    {children}
  </button>
);

const Switch = ({ on, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={() => onChange(!on)}
    className={`w-11 h-6 rounded-full relative transition cursor-pointer flex-shrink-0 ${on ? "bg-red-600" : "bg-white/20"}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
  </button>
);

const Row = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3 py-2">
    <span className="text-xs text-gray-300">{label}</span>
    <div className="flex items-center gap-1.5">{children}</div>
  </div>
);

const Heading = ({ children }) => (
  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-500 mt-3 mb-1">{children}</p>
);

const roundTenth = (n) => Math.round(n * 10) / 10;
const getFsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;

// ================================================================= PLAYER
// subtitles = [{ label, url }]   (url = direct link to .srt / .vtt)
// qualities = ["1080p","720p"] (separate links) + quality = current one + onQuality(label)
// For .m3u8 links the qualities come from the playlist itself.
export default function AdvancedPlayer({ src, poster, subtitles = [], storageKey, title, qualities = [], quality = "", onQuality }) {
  const boxRef = useRef(null);
  const videoRef = useRef(null);
  const barRef = useRef(null);
  const hideTimer = useRef(null);
  const flashTimer = useRef(null);
  const lastTap = useRef({ t: 0 });
  const lastSave = useRef(0);
  const lastActive = useRef("off");
  const watchdog = useRef(null);
  const nudges = useRef(0);
  const hlsRef = useRef(null);
  const ambientRef = useRef(null);
  const pendingSeek = useRef(0); // continue from here after the source changes / reloads
  const autoplayNext = useRef(false);
  const resumedOnce = useRef(false);
  const lastTime = useRef(0);
  const retries = useRef(0);
  const retryFrom = useRef(0);
  const stallTimer = useRef(null);

  // playback
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [failed, setFailed] = useState(false);
  const [errCode, setErrCode] = useState(0);
  const [reloadKey, setReloadKey] = useState(0); // bump = reload the video
  const [levels, setLevels] = useState([]); // HLS qualities [{ index, label, height, bitrate }]
  const [levelSel, setLevelSel] = useState(-1); // -1 = Auto
  const [levelNow, setLevelNow] = useState(-1);
  const [logoFailed, setLogoFailed] = useState(false);
  // an http:// video link is blocked on an https:// site (Safari) -> try the https:// version
  const playSrc =
    typeof window !== "undefined" && window.location.protocol === "https:" && /^http:\/\//i.test(src || "") ? src.replace(/^http:/i, "https:") : src;
  // interface
  const [showUI, setShowUI] = useState(true);
  const [panel, setPanel] = useState(false);
  const [nativeFs, setNativeFs] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);
  const [drag, setDrag] = useState(null);
  const [flash, setFlash] = useState(null);
  const [touch, setTouch] = useState(false);
  const [pipOK, setPipOK] = useState(false);
  const [a2hs, setA2hs] = useState(false); // "add to home screen" hint (iPhone only)
  const [cw, setCw] = useState(640);
  // subtitles
  const [tracks, setTracks] = useState([]); // [{ id, label, cues }]
  const [active, setActive] = useState("off");
  const [subFailed, setSubFailed] = useState(false);
  const [offset, setOffset] = useState(0); // seconds, + = subtitles appear later
  const [size, setSize] = useState(100); // %
  const [boxBg, setBoxBg] = useState(false); // dark box behind the text (off by default)
  const [lift, setLift] = useState(0); // move subtitles up/down
  const [ambient, setAmbient] = useState(true); // soft glow around the player that follows the picture
  const [cueIdx, setCueIdx] = useState([]);

  const isFs = nativeFs || pseudoFs;
  const current = tracks.find((t) => t.id === active) || null;
  const subsKey = JSON.stringify(subtitles);
  const posKey = storageKey ? `cl-pos-${storageKey}` : "";
  const uiVisible = showUI || !playing || panel || drag !== null;

  // keep latest values for timers / handlers
  const live = useRef({});
  live.current = { panel, drag, uiVisible, duration };

  // ---------- show controls, hide again after a few seconds while playing
  const poke = useCallback(() => {
    setShowUI(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused && !live.current.panel && live.current.drag === null) setShowUI(false);
    }, 3200);
  }, []);

  useEffect(() => {
    if (playing && !panel) poke();
    else {
      clearTimeout(hideTimer.current);
      setShowUI(true);
    }
  }, [playing, panel, poke]);

  useEffect(
    () => () => {
      clearTimeout(hideTimer.current);
      clearTimeout(flashTimer.current);
      clearTimeout(watchdog.current);
      clearTimeout(stallTimer.current);
    },
    []
  );

  // ---------- saved subtitle settings
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem("cl-sub-prefs") || "{}");
      if (typeof p.size === "number") setSize(p.size);
      if (typeof p.boxBg === "boolean") setBoxBg(p.boxBg);
      if (typeof p.lift === "number") setLift(p.lift);
      if (typeof p.ambient === "boolean") setAmbient(p.ambient);
      else if (window.matchMedia("(hover: none)").matches) setAmbient(false); // phones: off by default (saves battery)
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("cl-sub-prefs", JSON.stringify({ size, boxBg, lift, ambient }));
    } catch {
      /* ignore */
    }
  }, [size, boxBg, lift, ambient]);

  // ---------- device checks + size of the player (for subtitle font size)
  useEffect(() => {
    setTouch(window.matchMedia("(hover: none)").matches);
    const v = videoRef.current;
    setPipOK(!!(document.pictureInPictureEnabled || v?.webkitSupportsPresentationMode?.("picture-in-picture")));
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setCw(e[0].contentRect.width));
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  // ---------- fullscreen
  useEffect(() => {
    const onChange = () => {
      const el = getFsEl();
      setNativeFs(!!el && el === boxRef.current);
      if (!el) {
        try {
          screen.orientation?.unlock?.();
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  useEffect(() => {
    if (!pseudoFs) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setPseudoFs(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [pseudoFs]);

  const toggleFs = async () => {
    const box = boxRef.current;
    if (pseudoFs) return setPseudoFs(false);
    if (getFsEl()) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      return;
    }
    const enterPseudo = () => {
      setPseudoFs(true);
      // iPhone Safari can't hide its address bar: suggest installing the site as an app
      try {
        const iPhone = /iPhone|iPod/i.test(navigator.userAgent);
        const standalone = navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
        if (iPhone && !standalone && localStorage.getItem("cl-a2hs-off") !== "1") setA2hs(true);
      } catch {
        /* ignore */
      }
    };
    const req = box?.requestFullscreen || box?.webkitRequestFullscreen;
    if (!req) return enterPseudo(); // iPhone: no element fullscreen -> fill the screen ourselves
    try {
      await req.call(box);
      try {
        await screen.orientation?.lock?.("landscape");
      } catch {
        /* not supported */
      }
    } catch {
      enterPseudo();
    }
  };

  useEffect(() => {
    if (!pseudoFs) setA2hs(false);
  }, [pseudoFs]);

  // ---------- load subtitle files (through /api/sub so any link works)
  useEffect(() => {
    let alive = true;
    setTracks([]);
    setActive("off");
    setSubFailed(false);
    Promise.all(
      subtitles.map(async (s, i) => {
        try {
          const r = await fetch(`/api/sub?url=${encodeURIComponent(s.url)}`);
          if (!r.ok) throw new Error(String(r.status));
          const cues = parseCues(await r.text());
          return cues.length ? { id: `s${i}`, label: s.label || `Subtitle ${i + 1}`, cues } : null;
        } catch {
          return null;
        }
      })
    ).then((list) => {
      if (!alive) return;
      const ok = list.filter(Boolean);
      setTracks(ok);
      setSubFailed(subtitles.length > 0 && ok.length === 0);
      if (ok[0]) setActive(ok[0].id);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subsKey]);

  // ---------- which subtitle lines are visible right now
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !current) {
      setCueIdx([]);
      return;
    }
    let raf = 0;
    let last = "";
    const tick = () => {
      const idx = findActive(current.cues, v.currentTime - offset);
      const key = idx.join(",");
      if (key !== last) {
        last = key;
        setCueIdx(idx);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [current, offset]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);

  // Ambient light: draw a tiny copy of the picture and blur it behind the player
  useEffect(() => {
    const v = videoRef.current;
    const c = ambientRef.current;
    if (!ambient || !v || !c || pseudoFs) return;
    const ctx = c.getContext("2d");
    let stop = false;
    let last = 0;
    let raf = 0;
    const draw = () => {
      try {
        ctx.drawImage(v, 0, 0, c.width, c.height);
      } catch {
        /* the browser refused to read this video: just no glow */
      }
    };
    const tick = (now) => {
      if (stop) return;
      if (!document.hidden && v.readyState >= 2 && now - last > (v.paused ? 600 : 90)) {
        last = now;
        draw();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
    };
  }, [ambient, pseudoFs]);

  // Reload the video at the same spot (connection dropped / stalled). Gives up after 3 tries.
  const recover = () => {
    if (retries.current >= 3 || lastTime.current < 1) return false;
    retries.current += 1;
    retryFrom.current = lastTime.current;
    pendingSeek.current = lastTime.current;
    autoplayNext.current = true;
    setWaiting(true);
    setReloadKey((k) => k + 1);
    return true;
  };

  // Put the video source on the <video>. .m3u8 (HLS) goes through hls.js, which also gives us the qualities.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playSrc) return;
    let dead = false;
    let hls = null;
    let netTries = 0;
    setFailed(false);
    setLevels([]);
    setLevelSel(-1);
    setLevelNow(-1);
    const native = () => {
      v.src = playSrc;
    };
    if (!/\.m3u8(\?|#|$)/i.test(playSrc)) {
      native();
    } else {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (dead) return;
          if (Hls.isSupported()) {
            hls = new Hls({ maxBufferLength: 40, enableWorker: true });
            hlsRef.current = hls;
            hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
              const best = {};
              data.levels.forEach((l, i) => {
                const label = l.height ? `${l.height}p` : `${Math.round((l.bitrate || 0) / 1000)} kbps`;
                if (!best[label] || (l.bitrate || 0) > best[label].bitrate) best[label] = { index: i, label, height: l.height || 0, bitrate: l.bitrate || 0 };
              });
              setLevels(Object.values(best).sort((a, b) => b.height - a.height || b.bitrate - a.bitrate));
            });
            hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => setLevelNow(d.level));
            hls.on(Hls.Events.ERROR, (_e, d) => {
              if (!d.fatal) return;
              if (d.type === Hls.ErrorTypes.NETWORK_ERROR && ++netTries <= 5) hls.startLoad();
              else if (d.type === Hls.ErrorTypes.MEDIA_ERROR && netTries++ < 5) hls.recoverMediaError();
              else if (!recover()) setFailed(true);
            });
            hls.loadSource(playSrc);
            hls.attachMedia(v);
          } else if (v.canPlayType("application/vnd.apple.mpegurl")) native(); // iPhone Safari: built-in HLS
          else setFailed(true);
        })
        .catch(() => {
          if (dead) return;
          if (v.canPlayType("application/vnd.apple.mpegurl")) native();
          else setFailed(true);
        });
    }
    return () => {
      dead = true;
      if (hls) hls.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playSrc, reloadKey]);

  const pickLevel = (idx) => {
    setLevelSel(idx);
    if (hlsRef.current) hlsRef.current.nextLevel = idx; // -1 = automatic
  };
  const pickQuality = (q) => {
    if (q === quality) return;
    const v = videoRef.current;
    if (v) {
      pendingSeek.current = v.currentTime; // keep the same position and keep playing
      autoplayNext.current = !v.paused;
    }
    setWaiting(true);
    onQuality?.(q);
  };

  // After a seek some files keep playing (time + sound + subtitles) but the picture stays black.
  // If no video frame is painted for 2.5s while the time is moving, nudge the decoder (max 2 times).
  const armWatchdog = () => {
    const v = videoRef.current;
    if (!v || typeof v.requestVideoFrameCallback !== "function") return;
    clearTimeout(watchdog.current);
    const t0 = v.currentTime;
    let frame = false;
    v.requestVideoFrameCallback(() => {
      frame = true;
      nudges.current = 0;
    });
    watchdog.current = setTimeout(() => {
      if (frame || v.paused || v.ended) return;
      if (v.currentTime - t0 < 0.4) return; // still buffering, not a decoder problem
      if (nudges.current >= 2) return;
      nudges.current += 1;
      v.currentTime = v.currentTime + 0.05;
    }, 2500);
  };

  // ---------- actions
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const skip = (sec) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + sec));
    nudges.current = 0;
    setFlash({ side: sec < 0 ? "left" : "right", key: Date.now() });
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 650);
    poke();
  };

  const toggleSubs = () => {
    if (!tracks.length) return setPanel(true);
    if (active !== "off") {
      lastActive.current = active;
      setActive("off");
    } else setActive(lastActive.current !== "off" ? lastActive.current : tracks[0].id);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  };
  const changeVolume = (val) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = Math.max(0, Math.min(1, val));
    v.muted = v.volume === 0;
  };

  const togglePip = async () => {
    const v = videoRef.current;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (v?.requestPictureInPicture) await v.requestPictureInPicture();
      else if (v?.webkitSetPresentationMode)
        v.webkitSetPresentationMode(v.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture");
    } catch {
      /* not supported */
    }
  };

  // ---------- video events
  const readBuffered = (v) => {
    for (let i = 0; i < v.buffered.length; i++) {
      if (v.buffered.start(i) <= v.currentTime && v.buffered.end(i) >= v.currentTime) return v.buffered.end(i);
    }
    return 0;
  };
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setTime(v.currentTime);
    setBuffered(readBuffered(v));
    lastTime.current = v.currentTime;
    if (retries.current && v.currentTime - retryFrom.current > 15) retries.current = 0; // playing fine again
    if (posKey && Date.now() - lastSave.current > 5000) {
      lastSave.current = Date.now();
      try {
        localStorage.setItem(posKey, String(v.currentTime));
      } catch {
        /* ignore */
      }
    }
  };
  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration || 0);
    if (pendingSeek.current > 0) {
      // quality switch / reload: continue where we were
      try {
        v.currentTime = pendingSeek.current;
      } catch {
        /* ignore */
      }
      pendingSeek.current = 0;
    } else if (posKey && !resumedOnce.current) {
      try {
        const t = Number(localStorage.getItem(posKey));
        if (t > 5 && t < v.duration - 30) v.currentTime = t;
      } catch {
        /* ignore */
      }
    }
    resumedOnce.current = true;
    if (autoplayNext.current) {
      autoplayNext.current = false;
      v.play().catch(() => {});
    }
  };

  // ---------- seek bar
  const ratioFrom = (e) => {
    const r = barRef.current.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  const onBarDown = (e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag(ratioFrom(e));
  };
  const onBarMove = (e) => {
    if (drag !== null) setDrag(ratioFrom(e));
  };
  const onBarUp = (e) => {
    if (drag === null) return;
    const r = ratioFrom(e);
    setDrag(null);
    const v = videoRef.current;
    if (v && duration) v.currentTime = r * duration;
    nudges.current = 0;
    poke();
  };

  // ---------- tapping the picture
  const onSurfaceUp = (e) => {
    boxRef.current?.focus({ preventScroll: true });
    if (panel) return setPanel(false);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const now = Date.now();
    const isTouch = e.pointerType !== "mouse";
    const dbl = now - lastTap.current.t < 300;
    lastTap.current = { t: now };

    if (isTouch) {
      if (dbl && (x < 0.38 || x > 0.62)) return skip(x < 0.5 ? -10 : 10); // double-tap left / right
      if (live.current.uiVisible && playing) setShowUI(false);
      else poke();
    } else {
      togglePlay();
      poke();
    }
  };

  const onKey = (e) => {
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "SELECT") return;
    const k = e.key;
    if (tag === "BUTTON" && (k === " " || k === "Enter")) return;
    if (k === " " || k === "k" || k === "K") togglePlay();
    else if (k === "ArrowRight" || k === "l" || k === "L") skip(10);
    else if (k === "ArrowLeft" || k === "j" || k === "J") skip(-10);
    else if (k === "ArrowUp") changeVolume((videoRef.current?.volume ?? 1) + 0.1);
    else if (k === "ArrowDown") changeVolume((videoRef.current?.volume ?? 1) - 0.1);
    else if (k === "m" || k === "M") toggleMute();
    else if (k === "f" || k === "F") toggleFs();
    else if (k === "c" || k === "C") toggleSubs();
    else return;
    e.preventDefault();
    poke();
  };

  // ---------- numbers for the UI
  const shownTime = drag !== null && duration ? drag * duration : time;
  const playedPct = duration ? (shownTime / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;
  const fontSize = Math.round(Math.min(44, Math.max(14, cw * 0.026 + 6)) * (size / 100));
  const subBottom = (uiVisible ? (cw < 520 ? 66 : 88) : 16) + lift * 10;
  const hit = uiVisible ? "pointer-events-auto" : "pointer-events-none";

  return (
    <div className={pseudoFs ? "" : "relative -mx-4 sm:mx-0"}>
      {ambient && !pseudoFs && (
        <canvas
          ref={ambientRef}
          width={64}
          height={36}
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{
            left: "-5%",
            top: "-9%",
            width: "110%",
            height: "118%",
            filter: "blur(38px) saturate(1.7)",
            opacity: playing ? 0.65 : 0.35,
            transition: "opacity .8s",
            zIndex: 0,
          }}
        />
      )}
    <div
      ref={boxRef}
      tabIndex={0}
      onKeyDown={onKey}
      onContextMenu={(e) => e.preventDefault()}
      onPointerMove={(e) => e.pointerType === "mouse" && poke()}
      className={`cl-player text-white select-none bg-black overflow-hidden outline-none ${
        pseudoFs
          ? "fixed inset-0 z-[200] w-screen"
          : "relative z-[1] aspect-video rounded-none sm:rounded-3xl border-y sm:border border-white/10 shadow-2xl shadow-black/60"
      } ${isFs && !uiVisible ? "cursor-none" : ""}`}
      style={pseudoFs ? { height: "100dvh" } : undefined}
    >
      <style>{`
        .cl-player:fullscreen{width:100vw;height:100vh;aspect-ratio:auto;border-radius:0;border:0;margin:0}
        .cl-player:-webkit-full-screen{width:100vw;height:100vh;aspect-ratio:auto;border-radius:0;border:0;margin:0}
        @keyframes clflash{0%{opacity:0;transform:scale(.85)}25%{opacity:1}100%{opacity:0;transform:scale(1.08)}}
        .cl-range{-webkit-appearance:none;appearance:none;height:4px;border-radius:9999px;background:rgba(255,255,255,.25);outline:none}
        .cl-range::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:9999px;background:#ef4444;cursor:pointer}
        .cl-range::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:9999px;background:#ef4444;cursor:pointer}
      `}</style>

      {/* ---------- video (no native controls => no native download menu) ---------- */}
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        preload="metadata"
        controlsList="nodownload noremoteplayback"
        disableRemotePlayback
        className="absolute inset-0 w-full h-full object-contain bg-black"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onWaiting={() => {
          setWaiting(true);
          // stuck loading for 20s without an error -> reload at the same spot
          clearTimeout(stallTimer.current);
          stallTimer.current = setTimeout(() => {
            const el = videoRef.current;
            if (el && !el.paused && el.readyState < 3) recover();
          }, 20000);
        }}
        onPlaying={() => {
          setWaiting(false);
          clearTimeout(stallTimer.current);
        }}
        onCanPlay={() => {
          setWaiting(false);
          clearTimeout(stallTimer.current);
        }}
        onSeeked={() => {
          setWaiting(false);
          armWatchdog();
        }}
        onTimeUpdate={onTimeUpdate}
        onProgress={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onError={(e) => {
          if (!e.currentTarget.getAttribute("src") && !hlsRef.current) return; // source was just cleared
          setErrCode(e.currentTarget.error?.code || 0);
          if (!recover()) setFailed(true);
        }}
      />

      {/* ---------- tap / click surface ---------- */}
      <div className="absolute inset-0 z-10" onPointerUp={onSurfaceUp} />

      {/* ---------- double-tap feedback ---------- */}
      {flash && (
        <div
          key={flash.key}
          className={`absolute top-0 bottom-0 w-1/3 z-[14] flex items-center justify-center pointer-events-none ${flash.side === "left" ? "left-0" : "right-0"}`}
          style={{ animation: "clflash .65s ease-out forwards" }}
        >
          <div className="flex flex-col items-center gap-1 bg-white/20 rounded-full px-5 py-4">
            <ISkip dir={flash.side === "left" ? "back" : "fwd"} className="w-8 h-8" />
          </div>
        </div>
      )}

      {/* ---------- subtitles (drawn by the player) ---------- */}
      {current && cueIdx.length > 0 && (
        <div
          className="absolute inset-x-0 z-[15] flex justify-center px-[5%] pointer-events-none transition-[bottom] duration-200"
          style={{ bottom: subBottom }}
        >
          <div className="text-center max-w-full" style={{ fontSize }}>
            {cueIdx.map((i) => (
              <p key={i} className="leading-snug my-0.5">
                <span
                  style={
                    boxBg
                      ? { background: "rgba(0,0,0,.72)", padding: ".08em .45em", borderRadius: ".3em", fontWeight: 600, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }
                      : { fontWeight: 700, textShadow: "0 0 3px #000, 0 0 6px #000, 1px 1px 3px #000, -1px -1px 3px #000, 0 2px 6px #000" }
                  }
                  dangerouslySetInnerHTML={{ __html: cueHtml(current.cues[i].text) }}
                />
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ---------- top bar ---------- */}
      <div
        className={`absolute top-0 inset-x-0 z-20 px-3 sm:px-5 pt-3 pb-8 bg-gradient-to-b from-black/80 to-transparent flex items-center gap-3 transition-opacity duration-300 ${uiVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        {isFs && (
          <button onClick={toggleFs} aria-label="Exit fullscreen" className="w-9 h-9 rounded-full bg-white/10 hover:bg-red-600 flex items-center justify-center transition cursor-pointer">
            <IClose className="w-5 h-5" />
          </button>
        )}
        <p className="text-sm sm:text-base font-bold truncate flex-1 drop-shadow">{title}</p>
        {logoFailed ? (
          <span className="text-xs sm:text-sm font-black tracking-wider drop-shadow">
            <span className="text-red-500">Cine</span>Labz
          </span>
        ) : (
          <img src="/logo.png" alt="CineLabz" className="h-6 sm:h-8 w-auto object-contain drop-shadow-lg" onError={() => setLogoFailed(true)} />
        )}
      </div>

      {/* ---------- centre buttons ---------- */}
      <div className={`absolute inset-0 z-20 flex items-center justify-center gap-7 sm:gap-14 pointer-events-none transition-opacity duration-300 ${uiVisible ? "opacity-100" : "opacity-0"}`}>
        <button
          onClick={() => skip(-10)}
          aria-label="Back 10 seconds"
          className={`${hit} w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/60 border border-white/15 hover:bg-white/20 active:scale-90 flex items-center justify-center transition cursor-pointer`}
        >
          <ISkip dir="back" className="w-6 h-6 sm:w-8 sm:h-8" />
        </button>
        <button
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className={`${hit} w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 shadow-xl shadow-red-600/50 ring-4 ring-red-600/25 flex items-center justify-center transition cursor-pointer`}
        >
          {waiting ? <Spinner /> : playing ? <IPause className="w-8 h-8 sm:w-10 sm:h-10" /> : <IPlay className="w-8 h-8 sm:w-10 sm:h-10 ml-0.5" />}
        </button>
        <button
          onClick={() => skip(10)}
          aria-label="Forward 10 seconds"
          className={`${hit} w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/60 border border-white/15 hover:bg-white/20 active:scale-90 flex items-center justify-center transition cursor-pointer`}
        >
          <ISkip dir="fwd" className="w-6 h-6 sm:w-8 sm:h-8" />
        </button>
      </div>

      {/* ---------- bottom bar ---------- */}
      <div
        className={`absolute bottom-0 inset-x-0 z-20 px-3 sm:px-5 pb-2 sm:pb-3 pt-12 bg-gradient-to-t from-black/90 via-black/55 to-transparent transition-opacity duration-300 ${uiVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        {/* seek bar */}
        <div
          ref={barRef}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(shownTime)}
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          onPointerUp={onBarUp}
          onPointerCancel={() => setDrag(null)}
          className="group relative h-6 flex items-center cursor-pointer touch-none"
        >
          <div className="relative w-full h-1.5 group-hover:h-2 rounded-full bg-white/20 overflow-hidden transition-all">
            <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${bufferedPct}%` }} />
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-700 to-red-500" style={{ width: `${playedPct}%` }} />
          </div>
          <div
            className="absolute top-1/2 w-3.5 h-3.5 -ml-[7px] -translate-y-1/2 rounded-full bg-red-500 shadow-lg shadow-red-600/60 ring-2 ring-white/80 pointer-events-none"
            style={{ left: `${playedPct}%` }}
          />
        </div>

        {/* buttons */}
        <div className="flex items-center gap-1 sm:gap-2 mt-0.5">
          <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center transition cursor-pointer">
            {playing ? <IPause className="w-6 h-6" /> : <IPlay className="w-6 h-6" />}
          </button>

          <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center transition cursor-pointer">
            {muted || volume === 0 ? <IMute className="w-5 h-5" /> : <IVol className="w-5 h-5" />}
          </button>
          {!touch && (
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volume"
              className="cl-range w-16 sm:w-20 hidden sm:block"
            />
          )}

          <span className="text-[11px] sm:text-xs font-semibold tabular-nums text-gray-200 ml-1 whitespace-nowrap">
            {fmt(shownTime)} <span className="text-gray-500">/</span> {fmt(duration)}
          </span>

          <span className="flex-1" />

          <button
            onClick={toggleSubs}
            aria-label="Subtitles on/off"
            aria-pressed={active !== "off"}
            className={`relative w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer ${active !== "off" ? "bg-red-600 hover:bg-red-500" : "hover:bg-white/15"}`}
          >
            <ICC className="w-5 h-5" />
          </button>
          <button
            onClick={() => setPanel((p) => !p)}
            aria-label="Settings"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer ${panel ? "bg-white/20" : "hover:bg-white/15"}`}
          >
            <IGear className={`w-5 h-5 transition-transform ${panel ? "rotate-45" : ""}`} />
          </button>
          {pipOK && (
            <button onClick={togglePip} aria-label="Picture in picture" className="w-9 h-9 rounded-full hover:bg-white/15 hidden sm:flex items-center justify-center transition cursor-pointer">
              <IPip className="w-5 h-5" />
            </button>
          )}
          <button onClick={toggleFs} aria-label="Fullscreen" className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center transition cursor-pointer">
            {isFs ? <IFsExit className="w-5 h-5" /> : <IFs className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ---------- settings panel ---------- */}
      {panel && (
        <div
          className="absolute z-30 right-2 sm:right-4 bottom-[4.25rem] sm:bottom-20 w-[min(21rem,calc(100%-1rem))] max-h-[78%] overflow-y-auto rounded-2xl bg-neutral-950/97 border border-white/10 shadow-2xl shadow-black/70 p-4"
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <p className="font-black text-sm">
              <span className="text-red-500">Player</span> settings
            </p>
            <button onClick={() => setPanel(false)} aria-label="Close settings" className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-600 flex items-center justify-center transition cursor-pointer">
              <IClose className="w-4 h-4" />
            </button>
          </div>

          <Heading>Subtitles</Heading>
          {tracks.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">{subFailed ? "Subtitle couldn't be loaded. Check the subtitle link." : "No subtitle for this video."}</p>
          ) : (
            <>
              <Row label="Show subtitles">
                <Switch on={active !== "off"} onChange={() => toggleSubs()} label="Show subtitles" />
              </Row>
              {tracks.length > 1 && (
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {tracks.map((t) => (
                    <button key={t.id} onClick={() => setActive(t.id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${active === t.id ? "bg-red-600" : "bg-white/10 hover:bg-white/20"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
              <Row label="Text size">
                <Step onClick={() => setSize((s) => Math.max(50, s - 10))} disabled={size <= 50}>A−</Step>
                <span className="w-12 text-center text-xs font-bold tabular-nums">{size}%</span>
                <Step onClick={() => setSize((s) => Math.min(250, s + 10))} disabled={size >= 250}>A+</Step>
              </Row>
              <Row label="Position">
                <Step onClick={() => setLift((l) => Math.min(12, l + 1))} disabled={lift >= 12}>↑ Up</Step>
                <Step onClick={() => setLift((l) => Math.max(-3, l - 1))} disabled={lift <= -3}>↓ Down</Step>
              </Row>
              <Row label="Dark box behind text">
                <Switch on={boxBg} onChange={setBoxBg} label="Dark box behind text" />
              </Row>

              <div className="pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-300">Sync (delay)</span>
                  <span className={`text-xs font-bold tabular-nums ${offset !== 0 ? "text-red-400" : "text-gray-400"}`}>
                    {offset > 0 ? "+" : ""}
                    {offset.toFixed(1)}s
                  </span>
                </div>
                <div className="flex gap-1.5 mt-2">
                  <Step wide onClick={() => setOffset((o) => roundTenth(o - 0.5))}>−0.5</Step>
                  <Step wide onClick={() => setOffset((o) => roundTenth(o - 0.1))}>−0.1</Step>
                  <Step wide onClick={() => setOffset(0)} disabled={offset === 0}>Reset</Step>
                  <Step wide onClick={() => setOffset((o) => roundTenth(o + 0.1))}>+0.1</Step>
                  <Step wide onClick={() => setOffset((o) => roundTenth(o + 0.5))}>+0.5</Step>
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5">Subtitles too early? Use +. Too late? Use −.</p>
              </div>
            </>
          )}

          <Heading>Display</Heading>
          <Row label="Ambient light (glow)">
            <Switch on={ambient} onChange={setAmbient} label="Ambient light" />
          </Row>

          {(levels.length > 0 || qualities.length > 1) && (
            <>
              <Heading>Quality</Heading>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {levels.length > 0 ? (
                  <>
                    <button onClick={() => pickLevel(-1)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${levelSel === -1 ? "bg-red-600" : "bg-white/10 hover:bg-white/20"}`}>
                      Auto{levelSel === -1 && levels.find((l) => l.index === levelNow) ? ` · ${levels.find((l) => l.index === levelNow).label}` : ""}
                    </button>
                    {levels.map((l) => (
                      <button key={l.index} onClick={() => pickLevel(l.index)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${levelSel === l.index ? "bg-red-600" : "bg-white/10 hover:bg-white/20"}`}>
                        {l.label}
                      </button>
                    ))}
                  </>
                ) : (
                  qualities.map((q) => (
                    <button key={q} onClick={() => pickQuality(q)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${q === quality ? "bg-red-600" : "bg-white/10 hover:bg-white/20"}`}>
                      {q}
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          <Heading>Speed</Heading>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
              <button key={r} onClick={() => setRate(r)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${rate === r ? "bg-red-600" : "bg-white/10 hover:bg-white/20"}`}>
                {r === 1 ? "Normal" : `${r}x`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---------- iPhone: add to Home Screen hint ---------- */}
      {a2hs && (
        <div
          className="absolute z-[45] top-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:w-80 rounded-2xl bg-neutral-950/97 border border-red-600/50 shadow-2xl shadow-black/70 p-4"
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none">📲</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">Get a true full screen</p>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                To hide Safari's address bar, add CineLabz to your Home Screen: tap{" "}
                <span className="inline-flex align-middle mx-0.5">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share">
                    <path d="M12 15V3M8 7l4-4 4 4M6 11H5v10h14V11h-1" />
                  </svg>
                </span>{" "}
                <b>Share</b>, then <b>Add to Home Screen</b>. Open CineLabz from there.
              </p>
              <button
                onClick={() => {
                  try {
                    localStorage.setItem("cl-a2hs-off", "1");
                  } catch {
                    /* ignore */
                  }
                  setA2hs(false);
                }}
                className="text-[11px] text-gray-500 hover:text-gray-300 underline mt-2 cursor-pointer"
              >
                Don't show again
              </button>
            </div>
            <button onClick={() => setA2hs(false)} aria-label="Close" className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-600 flex items-center justify-center transition cursor-pointer flex-shrink-0">
              <IClose className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---------- can't play ---------- */}
      {failed && (
        <div className="absolute inset-0 z-40 bg-black/90 flex flex-col items-center justify-center text-center gap-2 p-6">
          <p className="font-black text-lg">This browser can't play this video</p>
          <p className="text-xs text-gray-400 max-w-md">
            For Safari / iPhone the video must be an MP4 (H.264 + AAC) on an https:// link. MKV, HEVC (x265) and 10-bit files don't play in most browsers.
            The server must also allow range requests and hotlinking.
          </p>
          <p className="text-[11px] text-gray-500 font-mono">
            error {errCode}: {{ 1: "loading stopped", 2: "network / blocked link", 3: "can't decode (codec)", 4: "link or format not supported" }[errCode] || "unknown"}
          </p>
          <button
            onClick={() => {
              retries.current = 0;
              if (lastTime.current > 1) pendingSeek.current = lastTime.current;
              autoplayNext.current = true;
              setFailed(false);
              setReloadKey((k) => k + 1);
            }}
            className="mt-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition"
          >
            Try again
          </button>
        </div>
      )}
    </div>
    </div>
  );
}