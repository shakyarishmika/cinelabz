// src/app/api/push/subscribe/route.js  — nothing to do server-side for saving (the browser
// writes its own subscription doc to Firestore directly). This route lets the player/admin
// check whether push is configured at all, and is a place to unsubscribe cleanly.
import { getAdmin } from "../../../firebaseAdmin";

export async function DELETE(req) {
  const { endpointId } = await req.json().catch(() => ({}));
  if (!endpointId) return Response.json({ ok: false }, { status: 400 });
  try {
    const { db } = getAdmin();
    await db.collection("pushSubs").doc(endpointId).delete();
  } catch {
    /* ignore */
  }
  return Response.json({ ok: true });
}
