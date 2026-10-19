"use client";

import { useEffect, useState } from "react";

// Only used for OLD data that has `telegramCode`. New titles use a full link (`telegramUrl`).
export const TELEGRAM_BOT = "";

// downloads = {
//   direct: [{ name: "Server 1", quality: "1080p", size: "2.1 GB", url: "https://..." }],
//   telegramUrl: "https://t.me/YourBot?start=abc"     // your own bot link
// }
// subtitleUrl = link of the subtitle file (.srt / .vtt) -> "Download subtitle" in the popup
export default function DownloadButtons({ downloads, title, subtitleUrl }) {
  const [open, setOpen] = useState(false);

  // Esc closes the popup + lock page scroll while it is open
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const servers = downloads?.direct || [];
  const telegramUrl =
    downloads?.telegramUrl ||
    (TELEGRAM_BOT && downloads?.telegramCode
      ? `https://t.me/${TELEGRAM_BOT}?start=${encodeURIComponent(downloads.telegramCode)}`
      : null);
  const subDownload = subtitleUrl
    ? `/api/sub?url=${encodeURIComponent(subtitleUrl)}&download=1&name=${encodeURIComponent(title || "subtitle")}`
    : null;

  if (!servers.length && !telegramUrl && !subDownload) return null;

  return (
    <>
      <div className="bg-neutral-900/60 border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm font-bold text-gray-200 sm:mr-auto">⬇ Download</p>
        <div className="grid grid-cols-2 sm:flex gap-3">
          {(servers.length > 0 || subDownload) && (
            <button
              onClick={() => setOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-lg shadow-red-600/30 cursor-pointer transition"
            >
              Direct
            </button>
          )}
          {telegramUrl && (
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#229ED9] hover:bg-[#1b8bbf] text-white px-5 py-3 rounded-xl text-sm font-bold text-center shadow-lg shadow-[#229ED9]/30 transition"
            >
              Telegram
            </a>
          )}
        </div>
      </div>

      {/* Servers popup — bottom sheet on phones, centered card on larger screens */}
      {open && (
        <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center sm:p-4">
          <div onClick={() => setOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Download"
            className="relative w-full sm:max-w-md bg-neutral-900 border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm cursor-pointer"
            >
              ✕
            </button>
            <h3 className="text-lg font-black pr-10">Download</h3>
            <p className="text-xs text-gray-400 mt-1 truncate">{title}</p>

            {servers.length > 0 && (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mt-5 mb-2">Servers</p>
                <ul className="space-y-2.5">
                  {servers.map((s, i) => (
                    <li key={`${s.name}-${i}`}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="flex items-center justify-between gap-3 bg-white/5 hover:bg-red-600/20 border border-white/10 hover:border-red-600/50 rounded-2xl px-4 py-3.5 transition"
                      >
                        <span className="font-semibold text-sm">{s.name}</span>
                        <span className="text-xs text-gray-400">{[s.quality, s.size].filter(Boolean).join(" • ")}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {subDownload && (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mt-5 mb-2">Subtitle</p>
                <a
                  href={subDownload}
                  className="flex items-center justify-between gap-3 bg-white/5 hover:bg-red-600/20 border border-white/10 hover:border-red-600/50 rounded-2xl px-4 py-3.5 transition"
                >
                  <span className="font-semibold text-sm">⬇ Download subtitle</span>
                  <span className="text-xs text-gray-400">.srt</span>
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}