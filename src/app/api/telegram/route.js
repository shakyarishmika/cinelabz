// src/app/api/telegram/route.js
// Webhook of the NEW notification bot. Telegram calls this when someone messages the bot.
//   /start <code>  -> connects that Telegram account to the website user who made <code>
//   /status        -> shows the user's latest requests
//   /disconnect    -> stops updates
import { getAdmin } from "../../firebaseAdmin";
import { escHtml, requestMessage, tgSend } from "../../telegram";

const ok = () => Response.json({ ok: true });

export async function POST(req) {
  const secret = process.env.TG_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  let update;
  try {
    update = await req.json();
  } catch {
    return ok();
  }
  const msg = update?.message;
  if (!msg?.text || !msg.chat) return ok();
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  try {
    const { db, FieldValue } = getAdmin();

    const start = text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?/i);
    if (start) {
      const code = start[1];
      if (!code || !/^[A-Za-z0-9_-]{8,64}$/.test(code)) {
        await tgSend(chatId, "👋 Hi! Open CineLabz, tap your profile picture → <b>Connect Telegram</b>, then press <b>Start</b> here.");
        return ok();
      }
      const ref = db.collection("tgLinks").doc(code);
      const snap = await ref.get();
      const d = snap.data();
      if (!snap.exists || !d || d.expiresAt < Date.now()) {
        await tgSend(chatId, "⚠️ That link has expired. Go back to CineLabz and tap <b>Connect Telegram</b> again.");
        return ok();
      }
      await db.collection("users").doc(d.uid).set(
        {
          tgId: chatId,
          tgUsername: msg.from?.username || "",
          tgName: msg.from?.first_name || "",
          tgConnectedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      await ref.delete();
      await tgSend(
        chatId,
        "✅ <b>Connected!</b>\nYou'll get a message here whenever the status of your CineLabz requests changes.\n\n/status : see your requests\n/disconnect : stop updates"
      );
      return ok();
    }

    // everything below needs a connected user
    const us = await db.collection("users").where("tgId", "==", chatId).limit(1).get();
    const userDoc = us.docs[0];

    if (/^\/disconnect/i.test(text)) {
      if (userDoc) {
        await userDoc.ref.update({ tgId: FieldValue.delete(), tgUsername: FieldValue.delete(), tgName: FieldValue.delete(), tgConnectedAt: FieldValue.delete() });
      }
      await tgSend(chatId, "🔕 Disconnected. You won't get updates any more.");
      return ok();
    }

    if (/^\/status/i.test(text)) {
      if (!userDoc) {
        await tgSend(chatId, "You're not connected yet. Open CineLabz → profile → <b>Connect Telegram</b>.");
        return ok();
      }
      const rs = await db.collection("requests").where("uid", "==", userDoc.id).get();
      const rows = rs.docs
        .map((x) => x.data())
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
        .slice(0, 8);
      await tgSend(
        chatId,
        rows.length ? rows.map((r) => `• <b>${escHtml(r.title)}</b>${r.year ? ` (${escHtml(r.year)})` : ""} : ${escHtml(r.status || "pending")}`).join("\n") : "You haven't requested anything yet."
      );
      return ok();
    }

    await tgSend(chatId, "Commands:\n/status : your requests\n/disconnect : stop updates");
  } catch (e) {
    console.error("Telegram webhook error:", e);
  }
  return ok();
}