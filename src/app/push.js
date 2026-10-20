// src/app/push.js  (SERVER ONLY — admin notify route)
// Needs: npm install web-push
// Env: VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_SUBJECT (e.g. mailto:you@example.com)
import webpush from "web-push";

let configured = false;
function setup() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("VAPID keys are not set");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  configured = true;
}

// subs: Firestore docs of shape { endpoint, keys: { p256dh, auth } }
// payload: { title, body, url, icon, tag }
export async function sendPush(subs, payload) {
  setup();
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body))
  );
  const dead = []; // expired/invalid subscriptions to clean up
  let sent = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") sent++;
    else if (r.reason?.statusCode === 404 || r.reason?.statusCode === 410) dead.push(subs[i].id);
  });
  return { sent, failed: results.length - sent, dead };
}
