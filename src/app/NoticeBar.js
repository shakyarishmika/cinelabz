// src/app/NoticeBar.js : the message bar shown above the player (set per title in the admin panel)
//   type "player"   -> red bar        (about the player / server)
//   type "telegram" -> light-blue bar (about the Telegram bot)
import TelegramLogo from "./TelegramLogo";

export default function NoticeBar({ notice }) {
  if (!notice?.text) return null;
  const tg = notice.type === "telegram";
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
        tg ? "bg-sky-400/15 border-sky-400/40 text-sky-100" : "bg-red-600/15 border-red-600/40 text-red-100"
      }`}
    >
      <span className={`mt-0.5 flex-shrink-0 ${tg ? "text-sky-300" : "text-red-400"}`}>
        {tg ? (
          <TelegramLogo className="w-5 h-5" />
        ) : (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
        )}
      </span>
      <span className="min-w-0">
        <span className={`block text-[10px] font-black uppercase tracking-wider ${tg ? "text-sky-300" : "text-red-400"}`}>
          {tg ? "Telegram Bot" : "Player / Server"}
        </span>
        <span className="block text-sm font-semibold break-words">{notice.text}</span>
      </span>
    </div>
  );
}
