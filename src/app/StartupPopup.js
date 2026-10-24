"use client";

// src/app/StartupPopup.js
//  - <StartupPopup />  : shown on the website when someone opens it (at most once a day per device).
//                        The text is set in the admin panel (Popup tab) and stored in settings/popup.
//  - <PopupCard />     : just the card (the admin panel uses it for the live preview).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

const KEY = "cl-popup-seen";
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the visitor's own time zone

export function PopupCard({ pop, onClose }) {
  const link = pop.buttonUrl?.trim();
  const external = /^https?:\/\//i.test(link || "");
  return (
    <div className="w-full max-w-md rounded-3xl bg-neutral-950 border border-red-600/40 shadow-2xl shadow-black/80 overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-red-700 via-red-500 to-red-700" />
      <div className="p-6 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-red-600/15 border border-red-600/40 flex items-center justify-center text-xl flex-shrink-0">📢</div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-black leading-snug break-words">{pop.title || "CineLabz"}</h2>
            <p className="text-sm text-gray-300 mt-2 leading-relaxed whitespace-pre-line break-words">{pop.message}</p>
          </div>
          {onClose && (
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-600 flex items-center justify-center text-sm transition cursor-pointer flex-shrink-0">
              ✕
            </button>
          )}
        </div>
        <div className="flex gap-2 mt-6">
          {link && (
            <a
              href={link}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              onClick={() => onClose?.()}
              className="flex-1 text-center bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg shadow-red-600/30 transition"
            >
              {pop.buttonText?.trim() || "Open"}
            </a>
          )}
          <button onClick={() => onClose?.()} className={`${link ? "" : "flex-1"} bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl text-sm font-semibold transition cursor-pointer`}>
            {link ? "Close" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StartupPopup() {
  const [pop, setPop] = useState(null);

  useEffect(() => {
    if (!db) return;
    let alive = true;
    getDoc(doc(db, "settings", "popup"))
      .then((snap) => {
        const d = snap.data();
        if (!alive || !d?.enabled || !d.message?.trim()) return;
        const version = String(d.updatedAt?.seconds || d.message.length);
        let seen = {};
        try {
          seen = JSON.parse(localStorage.getItem(KEY) || "{}");
        } catch {
          /* ignore */
        }
        if (seen.day === today() && seen.version === version) return; // already shown today
        setTimeout(() => alive && setPop({ ...d, version }), 900);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const close = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ day: today(), version: pop.version }));
    } catch {
      /* ignore */
    }
    setPop(null);
  };

  useEffect(() => {
    if (!pop) return;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pop]);

  if (!pop || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div onClick={close} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative w-full flex justify-center" role="dialog" aria-modal="true" aria-label={pop.title || "Announcement"}>
        <PopupCard pop={pop} onClose={close} />
      </div>
    </div>,
    document.body
  );
}
