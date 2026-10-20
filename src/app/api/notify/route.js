// src/app/api/notify/route.js
// Sends a Telegram message about a request.
//   event "status"   : called by the ADMIN panel after the status changes
//   event "received" : called by the user right after sending a request
// The caller must send their Firebase ID token:  Authorization: Bearer <token>
import { ADMIN_EMAILS } from "../../adminConfig";
import { getAdmin } from "../../firebaseAdmin";
import { requestMessage, tgSend } from "../../telegram";

const json = (body, status = 200) => Response.json(body, { status });

export async function POST(req) {
  let admin;
  try {
    admin = getAdmin();
  } catch (e) {
    return json({ sent: false, reason: "server-not-configured" }, 500);
  }
  const { auth, db } = admin;

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  let who;
  try {
    who = await auth.verifyIdToken(token);
  } catch {
    return json({ sent: false, reason: "unauthorized" }, 401);
  }

  const { requestId, event } = await req.json().catch(() => ({}));
  if (!requestId || typeof requestId !== "string") return json({ sent: false, reason: "bad-request" }, 400);

  const ref = db.collection("requests").doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) return json({ sent: false, reason: "not-found" }, 404);
  const r = snap.data();

  let text;
  if (event === "status") {
    const isAdmin = who.email_verified && ADMIN_EMAILS.includes((who.email || "").toLowerCase());
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