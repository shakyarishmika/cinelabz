"use client";

// src/app/AdvancedPlayer.js
// Video player + subtitle toolbar:
//  - loads .srt / .vtt subtitle files from the URLs given in `subtitles` (users cannot add their own)
//  - subtitle delay (sync) ±0.5s, on/off, speed, ±10s, picture-in-picture
//  - remembers where you stopped
//  - friendly message if the browser can't play the file (e.g. MKV in Safari/Firefox)

import { useEffect, useRef, useState } from "react";

// ---------- subtitle helpers (SRT -> WebVTT, with time shift) ----------
const pad = (n, l = 2) => String(n).padStart(l, "0");

function toSeconds(t) {
  const m = t.trim().match(/^(?:(\d+):)?(\d+):(\d+)[.,](\d{1,3})/);
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(`0.${m[4]}`);
}

function fmtTime(sec) {
  const total = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(total % 1000, 3)}`;
}

function toVtt(raw, offset = 0) {
  const TIME = /((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})/g;
  const text = raw
    .replace(/^\uFEFF/, "")
    .replace(/\r+/g, "")
    .replace(/^WEBVTT[^\n]*\n+/, "")
    .replace(TIME, (_, a, b) => `${fmtTime(toSeconds(a) + offset)} --> ${fmtTime(toSeconds(b) + offset)}`);
  return `WEBVTT\n\n${text}`;
}

const btn = "bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";
const sel = "bg-neutral-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none cursor-pointer";

// subtitles = [{ label: "Sinhala", url: "https://.../file.vtt" }]
export default function AdvancedPlayer({ src, poster, subtitles = [], storageKey }) {
  const videoRef = useRef(null);
  const lastActive = useRef("off");
  const lastSave = useRef(0);

  const [tracks, setTracks] = useState([]); // [{ id, label, raw }]
  const [active, setActive] = useState("off");
  const [offset, setOffset] = useState(0);
  const [rate, setRate] = useState(1);
  const [failed, setFailed] = useState(false);
  const [vttUrl, setVttUrl] = useState("");

  const subsKey = JSON.stringify(subtitles);
  const current = tracks.find((t) => t.id === active) || null;
  const posKey = storageKey ? `cl-pos-${storageKey}` : "";

  // Load the subtitle files given by URL (failed ones are skipped)
  useEffect(() => {
    let alive = true;
    setTracks([]);
    setActive("off");
    Promise.all(
      subtitles.map(async (s, i) => {
        try {
          const r = await fetch(s.url);
          if (!r.ok) throw new Error(String(r.status));
          return { id: `remote-${i}`, label: s.label || `Subtitle ${i + 1}`, raw: await r.text() };
        } catch {
          return null;
        }
      })
    ).then((list) => {
      if (!alive) return;
      const ok = list.filter(Boolean);
      setTracks(ok);
      if (ok[0]) setActive(ok[0].id);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subsKey]);

  // Build the WebVTT blob (with the delay applied) for the chosen subtitle
  useEffect(() => {
    if (!current) {
      setVttUrl("");
      return;
    }
    const url = URL.createObjectURL(new Blob([toVtt(current.raw, offset)], { type: "text/vtt" }));
    setVttUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [current, offset]);

  // Make sure the browser actually shows the track
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const apply = () => {
      for (const t of v.textTracks) t.mode = vttUrl ? "showing" : "disabled";
    };
    apply();
    const id = setTimeout(apply, 300);
    return () => clearTimeout(id);
  }, [vttUrl]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);

  const skip = (sec) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + sec));
  };

  const toggleSubs = () => {
    if (active !== "off") {
      lastActive.current = active;
      setActive("off");
    } else {
      setActive(lastActive.current !== "off" ? lastActive.current : tracks[0]?.id || "off");
    }
  };

  const pip = async () => {
    const v = videoRef.current;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v?.requestPictureInPicture();
    } catch {
      /* not supported */
    }
  };

  // Resume where you stopped
  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!posKey || !v) return;
    try {
      const t = Number(localStorage.getItem(posKey));
      if (t > 5 && t < v.duration - 30) v.currentTime = t;
    } catch {
      /* storage blocked */
    }
  };
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!posKey || !v) return;
    const now = Date.now();
    if (now - lastSave.current < 5000) return;
    lastSave.current = now;
    try {
      localStorage.setItem(posKey, String(v.currentTime));
    } catch {
      /* storage blocked */
    }
  };

  // Keyboard: ← → ±10s, C subtitles on/off, F fullscreen
  const onKey = (e) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === "arrowright") {
      skip(10);
      e.preventDefault();
    } else if (k === "arrowleft") {
      skip(-10);
      e.preventDefault();
    } else if (k === "c") {
      toggleSubs();
    } else if (k === "f") {
      if (document.fullscreenElement) document.exitFullscreen();
      else videoRef.current?.requestFullscreen?.();
    }
  };

  return (
    <div tabIndex={0} onKeyDown={onKey} className="space-y-3 outline-none">
      <style>{`.cl-video::cue{background:rgba(0,0,0,.7);color:#fff;font-size:1.1em}`}</style>

      <div className="relative aspect-video bg-black -mx-4 sm:mx-0 rounded-none sm:rounded-3xl overflow-hidden shadow-2xl border-y sm:border border-white/10">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          controls
          playsInline
          preload="metadata"
          className="cl-video w-full h-full object-contain"
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
          onError={() => setFailed(true)}
        >
          {vttUrl && <track key={vttUrl} kind="subtitles" src={vttUrl} srcLang="si" label={current?.label || "Subtitles"} default />}
        </video>

        {failed && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-center gap-3 p-6">
            <p className="font-bold">This browser can't play this file.</p>
            <p className="text-xs text-gray-400 max-w-md">
              MKV only works in Chrome / Edge, and only with H.264 video + AAC audio. Convert the file to MP4, or open it in VLC.
            </p>
            <a href={src} target="_blank" rel="noopener noreferrer" className="bg-red-600 hover:bg-red-700 px-5 py-2 rounded-xl text-sm font-bold">
              Open / download file
            </a>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="text-gray-400 font-bold uppercase tracking-wider">Sub</label>
        <select value={active} onChange={(e) => setActive(e.target.value)} className={sel}>
          <option value="off">Off</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        <span className="mx-1 text-white/20">|</span>
        <button onClick={() => setOffset((o) => Math.round((o - 0.5) * 10) / 10)} disabled={!current} className={btn}>
          −0.5s
        </button>
        <span className="text-gray-300 w-14 text-center">{offset > 0 ? "+" : ""}{offset.toFixed(1)}s</span>
        <button onClick={() => setOffset((o) => Math.round((o + 0.5) * 10) / 10)} disabled={!current} className={btn}>
          +0.5s
        </button>
        <button onClick={() => setOffset(0)} disabled={!current || offset === 0} className={btn}>
          Reset
        </button>

        <span className="mx-1 text-white/20">|</span>
        <button onClick={() => skip(-10)} className={btn}>
          ⏪ 10s
        </button>
        <button onClick={() => skip(10)} className={btn}>
          10s ⏩
        </button>
        <select value={rate} onChange={(e) => setRate(Number(e.target.value))} className={sel} aria-label="Speed">
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
            <option key={r} value={r}>
              {r}x
            </option>
          ))}
        </select>
        {typeof document !== "undefined" && document.pictureInPictureEnabled && (
          <button onClick={pip} className={btn}>
            PiP
          </button>
        )}
      </div>
    </div>
  );
}