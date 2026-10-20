"use client";

// src/app/NotificationBell.js — lets a visitor turn on site notifications.
import { useEffect, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const urlBase64ToUint8Array = (base64) => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export default function NotificationBell({ user }) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState("default"); // default | granted | denied | busy
  const [err, setErr] = useState("");

  useEffect(() => {
    const ok = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    setSupported(ok);
    if (ok) setStatus(Notification.permission);
  }, []);

  const enable = async () => {
    setErr("");
    setStatus("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm);
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      });
      const j = sub.toJSON();
      await setDoc(doc(db, "pushSubs", sub.endpoint.slice(-140).replace(/[^\w-]/g, "_")), {
        endpoint: j.endpoint,
        keys: j.keys,
        uid: user?.uid || null,
        createdAt: serverTimestamp(),
      });
      setStatus("granted");
    } catch (e) {
      setErr(e.message || "Couldn't enable notifications");
      setStatus(Notification.permission);
    }
  };

  if (!supported || status === "granted") return null;
  return (
    <button
      onClick={enable}
      disabled={status === "busy" || status === "denied"}
      title={status === "denied" ? "Notifications are blocked in your browser settings" : "Get notified about new movies & series"}
      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all shadow-md disabled:opacity-40 cursor-pointer"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6.2V11c0-3.3-1.75-6.06-4.75-6.79V3.5a1.25 1.25 0 1 0-2.5 0v.71C8.75 4.94 7 7.7 7 11v4.8L5 17.8V19h14v-1.2z" />
      </svg>
      {err && <span className="sr-only">{err}</span>}
    </button>
  );
}
