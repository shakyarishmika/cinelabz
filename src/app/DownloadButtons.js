"use client";

import { useEffect, useState } from "react";

// Your Telegram bot username (without @). Create it with @BotFather.
export const TELEGRAM_BOT = "YourCineLabzBot";

// downloads = {
//   direct: [{ name: "Server 1", quality: "1080p", size: "2.1 GB", url: "https://..." }],
//   telegramCode: "m11"   // the code your bot understands (see bot.py)
// }
export default function DownloadButtons({ downloads, title }) {
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

  if (!downloads) return null;
  const servers = downloads.direct || [];
  const telegramUrl = downloads.telegramCode
    ? `https://t.me/${TELEGRAM_BOT}?start=${encodeURIComponent(downloads.telegramCode)}`
    : null;

  return (
    <>
      <div className="bg-neutral-900/60 border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm font-bold text-gray-200 sm:mr-auto">⬇ Download</p>
        <div className="grid grid-cols-2 sm:flex gap-3">
          {servers.length > 0 && (
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
            aria-label="Download servers"
            className="relative w-full sm:max-w-md bg-neutral-900 border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm cursor-pointer"
            >
              ✕
            </button>
            <h3 className="text-lg font-black pr-10">Choose a server</h3>
            <p className="text-xs text-gray-400 mt-1 truncate">{title}</p>

            <ul className="mt-5 space-y-2.5">
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
                    <span className="text-xs text-gray-400">
                      {[s.quality, s.size].filter(Boolean).join(" • ")}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
