"use client";

// src/app/NotificationBell.js
//  - Desktop: a 🔔 icon in the navbar (hidden on phones).
//  - After a user signs in: a friendly "Allow notifications?" card appears (once in a while).
//    The browser's own permission box only opens when they tap "Allow".
//  - If notifications were already allowed, this device is quietly linked to the signed-in user.
//  iPhone note: web push only works after "Add to Home Screen" (iOS 16.4+). In a normal Safari tab
//  nothing is shown, because the browser doesn't support it there.
import { useCallback, useEffect, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const urlBase64ToUint8Array = (base64) => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const LATER_KEY = "cl-push-later"; // don't ask again until this time (ms)
const askLater = (days) => {
  try {
    localStorage.setItem(LATER_KEY, String(Date.now() + days * 86400000));
  } catch {
    /* ignore */
  }
};

// Register the service worker, subscribe, and save the subscription in Firestore
async function subscribeAndSave(user) {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    }));
  const j = sub.toJSON();
  await setDoc(
    doc(db, "pushSubs", sub.endpoint.slice(-140).replace(/[^\w-]/g, "_")),
    { endpoint: j.endpoint, keys: j.keys, uid: user?.uid || null, createdAt: serverTimestamp() },
    { merge: true }
  );
}

export default function NotificationBell({ user }) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState("default"); // default | granted | denied | busy
  const [showCard, setShowCard] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      !!db;
    setSupported(ok);
    if (ok) setStatus(Notification.permission);
  }, []);

  // Already allowed on this device -> link it to whoever is signed in (no popup)
  useEffect(() => {
    if (supported && user && status === "granted") subscribeAndSave(user).catch(() => {});
  }, [supported, user, status]);

  // Signed in + not decided yet -> show our friendly card after a moment
  useEffect(() => {
    if (!supported || !user || status !== "default") {
      setShowCard(false);
      return;
    }
    try {
      if (Date.now() < Number(localStorage.getItem(LATER_KEY) || 0)) return;
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => setShowCard(true), 1500);
    return () => clearTimeout(t);
  }, [supported, user, status]);

  const enable = useCallback(async () => {
    setErr("");
    setStatus("busy");
    try {
      const perm = await Notification.requestPermission(); // the browser's own "Allow?" box
      if (perm !== "granted") {
        setStatus(perm);
        setShowCard(false);
        askLater(30);
        return;
      }
      await subscribeAndSave(user);
      setStatus("granted");
      setShowCard(false);
    } catch (e) {
      setErr(e.message || "Couldn't enable notifications");
      setStatus(Notification.permission);
    }
  }, [user]);

  const notNow = () => {
    askLater(7);
    setShowCard(false);
  };

  return (
    <>
      {/* navbar icon: desktop only */}
      {supported && status !== "granted" && (
        <button
          onClick={enable}
          disabled={status === "busy" || status === "denied"}
          title={status === "denied" ? "Notifications are blocked in your browser settings" : "Get notified about new movies & series"}
          aria-label="Enable notifications"
          className="hidden md:flex w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 items-center justify-center text-white transition-all shadow-md disabled:opacity-40 cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6.2V11c0-3.3-1.75-6.06-4.75-6.79V3.5a1.25 1.25 0 1 0-2.5 0v.71C8.75 4.94 7 7.7 7 11v4.8L5 17.8V19h14v-1.2z" />
          </svg>
        </button>
      )}

      {/* after sign-in card: bottom sheet on phones, small card on desktop */}
      {showCard && (
        <div className="fixed z-[80] inset-x-3 bottom-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96 rounded-2xl bg-neutral-950 border border-red-600/40 shadow-2xl shadow-black/70 p-5">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-red-600/15 border border-red-600/40 flex items-center justify-center text-xl flex-shrink-0">🔔</div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-sm">Get notified about new movies?</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">Be the first to know when new movies and series are added to CineLabz.</p>
              {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={enable}
                  disabled={status === "busy"}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition"
                >
                  {status === "busy" ? "…" : "Allow"}
                </button>
                <button onClick={notNow} className="bg-white/10 hover:bg-white/20 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition">
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}