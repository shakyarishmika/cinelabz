// src/app/telegram.js  (SERVER ONLY)
// Env: TG_NOTIFY_BOT_TOKEN = token of the NEW notification bot (from @BotFather)

export const escHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const STATUS_TEXT = {
  pending: "⏳ <b>Pending</b>: we got your request.",
  approved: "✅ <b>Approved</b>: we'll add it soon.",
  added: "🎬 <b>Added!</b> It's now on CineLabz.",
  rejected: "❌ <b>Not available</b>: sorry, we can't add this one.",
};

export async function tgSend(chatId, text) {
  const token = process.env.TG_NOTIFY_BOT_TOKEN;
  if (!token) throw new Error("TG_NOTIFY_BOT_TOKEN is not set");
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  return r.ok;
}

export function requestMessage(r, status) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ? `\n\n${process.env.NEXT_PUBLIC_SITE_URL}` : "";
  return `<b>${escHtml(r.title)}</b>${r.year ? ` (${escHtml(r.year)})` : ""}\n${STATUS_TEXT[status] || escHtml(status)}${status === "added" ? site : ""}`;
}
