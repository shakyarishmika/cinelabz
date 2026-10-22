// src/app/api/notify/route.js
// Sends Telegram / push messages. The caller must send their Firebase ID token:
//   Authorization: Bearer <token>
//   event "status"       : ADMIN panel -> the status of a request changed (Telegram)
//   event "received"     : the user, right after sending a request (Telegram)
//   event "contactReply" : ADMIN panel -> the admin answered a Contact-us message
//                          (browser push to that user's devices ONLY, nothing goes to Telegram)
import { ADMIN_EMAILS } from "../../adminConfig";
import { getAdmin, verifyIdToken } from "../../firebaseAdmin";
import { sendPush } from "../../push";
import { requestMessage, tgSend } from "../../telegram";

const json = (body, status = 200) => Response.json(body, { status });

export async function POST(req) {
  let admin;
  try {
    admin = getAdmin();
  } catch (e) {
    return json({ sent: false, ok: false, reason: "server-not-configured" }, 500);
  }
  const { db } = admin;

  const site = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || new URL(req.url).origin;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  let who;
  try {
    who = await verifyIdToken(token, `${site.replace(/\/$/, "")}/`);
  } catch {
    return json({ sent: false, ok: false, reason: "unauthorized" }, 401);
  }
  const isAdmin = who.email_verified && ADMIN_EMAILS.includes((who.email || "").toLowerCase());

  const body = await req.json().catch(() => ({}));
  const { requestId, event } = body;

  // ---------- admin answered a Contact-us message ----------
  if (event === "contactReply") {
    if (!isAdmin) return json({ ok: false, reason: "forbidden" }, 403);
    const uid = typeof body.uid === "string" ? body.uid : "";
    const text = String(body.text || "").trim();
    if (!uid || !text) return json({ ok: false, reason: "bad-request" }, 400);

    const result = { ok: true, push: 0 };
    try {
      const subs = (await db.collection("pushSubs").where("uid", "==", uid).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
      if (subs.length) {
        const r = await sendPush(subs, { title: "Reply from CineLabz Admin", body: text.slice(0, 140), url: "/?page=contact", tag: "cinelabz-reply" });
        result.push = r.sent;
        await Promise.all(r.dead.map((id) => db.collection("pushSubs").doc(id).delete().catch(() => {})));
      }
    } catch (e) {
      console.error("push failed:", e);
    }
    return json(result);
  }

  // ---------- request status messages ----------
  if (!requestId || typeof requestId !== "string") return json({ sent: false, reason: "bad-request" }, 400);

  const ref = db.collection("requests").doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) return json({ sent: false, reason: "not-found" }, 404);
  const r = snap.data();

  let text;
  if (event === "status") {
    if (!isAdmin) return json({ sent: false, reason: "forbidden" }, 403);
    text = requestMessage(r, r.status || "pending");
  } else if (event === "received") {
    if (who.uid !== r.uid) return json({ sent: false, reason: "forbidden" }, 403);
    if (r.tgReceivedSent) return json({ sent: false, reason: "already-sent" });
    text = `📨 <b>Request received!</b>\n${requestMessage(r, "pending")}`;
  } else {
    return json({ sent: false, reason: "bad-request" }, 400);
  }

  const user = await db.collection("users").doc(r.uid).get();
  const tgId = user.data()?.tgId;
  if (!tgId) return json({ sent: false, reason: "no-telegram" });

  const sent = await tgSend(tgId, text).catch(() => false);
  if (sent && event === "received") await ref.update({ tgReceivedSent: true });
  return json({ sent });
}