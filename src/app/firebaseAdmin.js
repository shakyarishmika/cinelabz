// src/app/firebaseAdmin.js  (SERVER ONLY: used by the /api routes)
// Needs:  npm install firebase-admin
// Env:    FIREBASE_SERVICE_ACCOUNT = the service-account JSON (paste the whole file, or base64 of it)
//
// NOTE: we do NOT import "firebase-admin/auth" (it crashes on Vercel with an ERR_REQUIRE_ESM / jose error).
// Sign-in tokens are checked with verifyIdToken() below instead.
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

export function getAdmin() {
  if (!getApps().length) {
    const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
    const json = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
    initializeApp({
      credential: cert({
        projectId: json.project_id,
        clientEmail: json.client_email,
        privateKey: String(json.private_key).replace(/\\n/g, "\n"),
      }),
    });
  }
  return { db: getFirestore(), FieldValue };
}

// Checks a Firebase sign-in token with Google (signature + expiry) and returns who it belongs to.
// Uses your public web API key (NEXT_PUBLIC_FIREBASE_API_KEY), no extra library needed.
export async function verifyIdToken(idToken, referer) {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key || !idToken) throw new Error("missing token or API key");
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(referer ? { Referer: referer } : {}) },
    body: JSON.stringify({ idToken }),
  });
  if (!r.ok) throw new Error("invalid token");
  const user = (await r.json()).users?.[0];
  if (!user?.localId) throw new Error("invalid token");
  return { uid: user.localId, email: user.email || "", email_verified: !!user.emailVerified };
}