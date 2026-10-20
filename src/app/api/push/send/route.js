// src/app/api/push/send/route.js  (ADMIN ONLY)
// Sends a browser push notification to everyone subscribed, and optionally a Telegram
// broadcast to everyone who connected their Telegram.
import { ADMIN_EMAILS } from "../../../adminConfig";
import { getAdmin, verifyIdToken } from "../../../firebaseAdmin";
import { sendPush } from "../../../push";
import { escHtml, tgSend } from "../../../telegram";

export async function POST(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const site = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || new URL(req.url).origin;
  let who;
  try {
    who = await verifyIdToken(token, `${site.replace(/\/$/, "")}/`);
  } catch {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  if (!who.email_verified || !ADMIN_EMAILS.includes((who.email || "").toLowerCase())) {
    return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const { title, body, url, alsoTelegram } = await req.json().catch(() => ({}));
  if (!title?.trim() || !body?.trim()) return Response.json({ ok: false, reason: "bad-request" }, { status: 400 });

  const { db } = getAdmin();
  let pushResult = { sent: 0, failed: 0 };
  try {
    const subsSnap = await db.collection("pushSubs").get();
    const subs = subsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (subs.length) {
      const r = await sendPush(subs, { title: title.trim(), body: body.trim(), url: url?.trim() || "/", tag: "cinelabz-announce" });
      pushResult = { sent: r.sent, failed: r.failed };
      await Promise.all(r.dead.map((id) => db.collection("pushSubs").doc(id).delete().catch(() => {})));
    }
  } catch (e) {
    pushResult.error = e.message;
  }

  let tgResult = { sent: 0 };
  if (alsoTelegram) {
    const usersSnap = await db.collection("users").where("tgId", "!=", null).get();
    const ids = usersSnap.docs.map((d) => d.data().tgId).filter(Boolean);
    const text = `📢 <b>${escHtml(title.trim())}</b>\n${escHtml(body.trim())}`;
    const results = await Promise.allSettled(ids.map((id) => tgSend(id, text)));
    tgResult.sent = results.filter((r) => r.status === "fulfilled" && r.value).length;
  }

  return Response.json({ ok: true, push: pushResult, telegram: tgResult });
}
