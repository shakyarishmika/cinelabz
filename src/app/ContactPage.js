"use client";

// src/app/ContactPage.js  : "Contact us" page (opens at /?page=contact)
//  1) message the admin bot on Telegram (just a link, the bot is already programmed)
//  2) send a message from the site and read the admin's replies here
import { useEffect, useRef, useState } from "react";
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "./firebase";
import TelegramLogo from "./TelegramLogo";

const ADMIN_BOT = "CinelabzAdminBot"; // username of your admin bot (without @)

const timeStr = (ts) => (ts?.toDate ? ts.toDate().toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "sending…");

function AdminAvatar() {
  const [failed, setFailed] = useState(false);
  return (
    <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-900 border-2 border-red-600 shadow-md shadow-red-600/30 flex items-center justify-center text-xs font-black text-red-500 flex-shrink-0">
      {failed ? "A" : <img src="/AdminLogo.png" alt="Admin" className="w-full h-full object-cover" onError={() => setFailed(true)} />}
    </div>
  );
}

export default function ContactPage({ user, authLoading, onSignIn, onBack }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const listRef = useRef(null);

  // my conversation with the admin (live)
  useEffect(() => {
    if (!user || !db) {
      setMsgs([]);
      return;
    }
    const q = query(collection(db, "messages"), where("uid", "==", user.uid));
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (a.createdAt?.seconds ?? 1e12) - (b.createdAt?.seconds ?? 1e12)); // oldest first
        setMsgs(rows);
      },
      (e) => setErr(e.code === "permission-denied" ? "Messages are blocked: publish the latest firestore.rules." : `Can't load messages (${e.code}).`)
    );
  }, [user]);

  // keep the newest message in view (scroll only the chat box, not the page)
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  const send = async (e) => {
    e.preventDefault();
    setErr("");
    if (!user) return onSignIn();
    const clean = text.trim();
    if (clean.length < 2) return setErr("Write your message first.");
    setSending(true);
    try {
      await addDoc(collection(db, "messages"), {
        uid: user.uid,
        from: "user",
        userName: user.displayName || "CineLabz user",
        userEmail: user.email || "",
        photoURL: user.photoURL || "",
        text: clean.slice(0, 1000),
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (e2) {
      setErr(e2.code === "permission-denied" ? "You can't send messages right now (blocked, or rules not published)." : "Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pt-28 sm:pt-36 max-w-3xl w-full min-w-0 mx-auto px-4 sm:px-6 pb-16 space-y-6">
      <button onClick={onBack} className="bg-white/10 hover:bg-white/20 border border-white/10 px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 cursor-pointer transition">
        ← Back to Home
      </button>

      <div>
        <p className="text-red-500 font-bold text-xs uppercase tracking-widest mb-1">We're listening</p>
        <h1 className="text-3xl sm:text-4xl font-black">Contact us</h1>
        <p className="text-gray-400 text-sm mt-2">Questions, problems or ideas? Pick whichever way is easier for you.</p>
      </div>

      {/* OPTION 1: Telegram */}
      <div className="rounded-3xl bg-sky-400/10 border border-sky-400/30 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-sky-400/15 border border-sky-400/40 flex items-center justify-center text-sky-300 flex-shrink-0">
          <TelegramLogo className="w-7 h-7" />
        </div>
        <div className="sm:mr-auto min-w-0">
          <p className="font-black">Message us on Telegram</p>
          <p className="text-sm text-sky-200/80 mt-0.5">Open @{ADMIN_BOT} and just write your message.</p>
        </div>
        <a
          href={`https://t.me/${ADMIN_BOT}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 bg-[#229ED9] hover:bg-[#1b8bbf] text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-[#229ED9]/30 transition"
        >
          <TelegramLogo className="w-5 h-5" /> Open Telegram
        </a>
      </div>

      {/* OPTION 2: message from the site */}
      <div className="rounded-3xl bg-neutral-900/70 border border-white/10 p-5 sm:p-6 space-y-4">
        <div>
          <p className="font-black">Or send a message here</p>
          <p className="text-sm text-gray-400 mt-0.5">The admin's reply shows up below, and you get a notification when it arrives.</p>
        </div>

        {authLoading ? (
          <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />
        ) : !user ? (
          <div className="text-center space-y-3 py-6">
            <p className="text-sm text-gray-400">Sign in with Google to send a message.</p>
            <button onClick={onSignIn} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-red-600/30 cursor-pointer transition">
              Sign In
            </button>
          </div>
        ) : (
          <>
            <div ref={listRef} className="max-h-[26rem] overflow-y-auto space-y-3 pr-1">
              {msgs.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No messages yet. Say hi 👋</p>
              ) : (
                msgs.map((m) =>
                  m.from === "admin" ? (
                    <div key={m.id} className="flex gap-2.5 items-end">
                      <AdminAvatar />
                      <div className="max-w-[80%]">
                        <div className="bg-neutral-800 rounded-2xl rounded-bl-md px-4 py-2.5">
                          <p className="text-[10px] font-black uppercase tracking-wider text-red-400 mb-0.5">Admin</p>
                          <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 ml-1">{timeStr(m.createdAt)}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[80%]">
                        <div className="bg-red-600 rounded-2xl rounded-br-md px-4 py-2.5">
                          <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 mr-1 text-right">{timeStr(m.createdAt)}</p>
                      </div>
                    </div>
                  )
                )
              )}
            </div>

            <form onSubmit={send} className="space-y-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Write your message…"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-600/70 resize-none"
              />
              {err && <p className="text-sm text-red-400">{err}</p>}
              <button type="submit" disabled={sending} className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-red-600/30 transition cursor-pointer">
                {sending ? "Sending…" : "Send message"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
