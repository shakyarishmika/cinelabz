// src/app/firebaseAdmin.js  (SERVER ONLY: used by the /api routes)
// Needs:  npm install firebase-admin
// Env:    FIREBASE_SERVICE_ACCOUNT = the service-account JSON (paste the whole file, or base64 of it)
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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
  return { auth: getAuth(), db: getFirestore(), FieldValue };
}
