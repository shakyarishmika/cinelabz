"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "./firebase";

const LANGS = ["English", "Tamil", "Hindi", "Kannada", "Korean", "Other"];

const STATUS_STYLES = {
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  approved: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  added: "bg-green-500/15 text-green-400 border-green-500/30",
  rejected: "bg-red-500/15 text-red-400 border-red-500/30",
};

const inputCls =
  "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-600/70 focus:ring-1 focus:ring-red-600/40 transition";

// tg = { username, name } when the user's Telegram is connected, else null
// onConnectTelegram = starts the connect flow (null when the notification bot isn't set up)
export default function RequestPage({ user, authLoading, onSignIn, onBack, tg, onConnectTelegram }) {
  const [type, setType] = useState("movie");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [language, setLanguage] = useState("English");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null); // { ok: boolean, text: string }
  const [mine, setMine] = useState([]);

  // The signed-in user's own requests (live)
  useEffect(() => {
    if (!user || !db) {
      setMine([]);
      return;
    }
    const q = query(collection(db, "requests"), where("uid", "==", user.uid));
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (b.createdAt?.seconds ?? 1e12) - (a.createdAt?.seconds ?? 1e12));
        setMine(rows);
      },
      (err) => console.error("Requests listener error:", err)
    );
  }, [user]);

  // Tell the user on Telegram that we got the request (only if their Telegram is connected)
  const notifyReceived = async (requestId) => {
    try {
      const token = await user.getIdToken();
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId, event: "received" }),
      });
    } catch {
      /* the request itself is already saved; ignore */
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!user) return onSignIn(); // sign-in is mandatory
    if (!db) return setMessage({ ok: false, text: "Requests are not set up yet (Firebase keys missing)." });

    const cleanTitle = title.trim();
    const cleanYear = year.trim();
    if (cleanTitle.length < 2) return setMessage({ ok: false, text: "Please enter the movie / series name." });
    if (cleanYear && !/^(19|20)\d{2}$/.test(cleanYear))
      return setMessage({ ok: false, text: "Year must be like 2024." });

    setSubmitting(true);
    try {
      const ref = await addDoc(collection(db, "requests"), {
        uid: user.uid,
        userName: user.displayName || "",
        userEmail: user.email || "",
        type, // "movie" | "series"
        title: cleanTitle.slice(0, 120),
        year: cleanYear,
        language,
        note: note.trim().slice(0, 500),
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setYear("");
      setNote("");
      setMessage({ ok: true, text: "Request sent! We'll add it as soon as possible. 🎬" });
      if (tg) notifyReceived(ref.id);
    } catch (err) {
      console.error("Request error:", err);
      setMessage({
        ok: false,
        text:
          err.code === "permission-denied"
            ? "You can't send requests right now (blocked or rules not published)."
            : "Couldn't send your request. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-28 sm:pt-36 max-w-3xl w-full mx-auto px-4 sm:px-6 pb-16 space-y-8">
      <button
        onClick={onBack}
        className="bg-white/10 hover:bg-white/20 border border-white/10 px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 cursor-pointer transition"
      >
        ← Back to Home
      </button>

      <div>
        <p className="text-red-500 font-bold text-xs uppercase tracking-widest mb-1">Can't find it?</p>
        <h1 className="text-3xl sm:text-4xl font-black">Request a Movie or TV Series</h1>
        <p className="text-gray-400 text-sm mt-2">Tell us what you want to watch and we'll try to add it to CineLabz.</p>
      </div>

      {authLoading ? (
        <div className="h-48 rounded-3xl bg-neutral-900/60 border border-white/10 animate-pulse" />
      ) : !user ? (
        /* SIGN-IN GATE */
        <div className="bg-neutral-900/70 border border-white/10 rounded-3xl p-8 sm:p-10 text-center space-y-4 backdrop-blur-md">
          <div className="mx-auto w-14 h-14 rounded-full bg-red-600/15 border border-red-600/30 flex items-center justify-center text-2xl">
            🔒
          </div>
          <h2 className="text-xl font-bold">Sign in required</h2>
          <p className="text-gray-400 text-sm">You need to sign in with Google before you can send a request.</p>
          <button
            onClick={onSignIn}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-red-600/30 cursor-pointer transition"
          >
            Sign In
          </button>
        </div>
      ) : (
        <>
          {/* TELEGRAM UPDATES */}
          {tg ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-sky-400/15 border border-sky-400/40 text-sky-300 px-4 py-2.5 text-xs sm:text-sm font-bold">
              <span>✈ TG: {tg.username ? `@${tg.username}` : tg.name || "account"} connected</span>
              <span className="font-normal text-sky-200/70">We'll message you when your request status changes.</span>
            </div>
          ) : onConnectTelegram ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl bg-sky-400/10 border border-sky-400/30 px-4 py-3">
              <p className="text-sm text-sky-200 sm:mr-auto">Get the status of your requests on Telegram.</p>
              <button
                onClick={onConnectTelegram}
                className="bg-sky-400/20 hover:bg-sky-400/30 border border-sky-400/40 text-sky-200 px-5 py-2 rounded-full text-xs font-bold cursor-pointer transition"
              >
                ✈ Connect Telegram
              </button>
            </div>
          ) : null}

          {/* REQUEST FORM */}
          <form
            onSubmit={handleSubmit}
            className="bg-neutral-900/70 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-5 backdrop-blur-md"
          >
            <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
              {[
                ["movie", "🎬 Movie"],
                ["series", "📺 TV Series"],
              ].map(([val, label]) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setType(val)}
                  className={`py-2.5 rounded-lg text-sm font-bold transition cursor-pointer ${
                    type === val ? "bg-red-600 text-white shadow" : "text-gray-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                {type === "movie" ? "Movie name" : "TV series name"} <span className="text-red-500">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder={type === "movie" ? "e.g. The Dark Knight" : "e.g. Money Heist"}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Year (optional)
                </label>
                <input
                  value={year}
                  onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  placeholder="2024"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Language</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
                  {LANGS.map((l) => (
                    <option key={l} value={l} className="bg-neutral-900">
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                Note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Season number, quality, Sinhala subtitles, etc."
                className={`${inputCls} resize-none`}
              />
            </div>

            {message && (
              <p
                className={`text-sm rounded-lg px-4 py-3 border ${
                  message.ok
                    ? "text-green-400 bg-green-500/10 border-green-500/20"
                    : "text-red-400 bg-red-500/10 border-red-500/20"
                }`}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-wait text-white py-3.5 rounded-xl font-bold shadow-lg shadow-red-600/30 transition cursor-pointer"
            >
              {submitting ? "Sending…" : "Send Request"}
            </button>
          </form>

          {/* MY REQUESTS */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold">Your requests</h2>
            {mine.length === 0 ? (
              <p className="text-sm text-gray-500 bg-neutral-900/40 border border-white/5 rounded-2xl px-5 py-6 text-center">
                You haven't requested anything yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {mine.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 bg-neutral-900/60 border border-white/10 rounded-2xl px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {r.title} {r.year && <span className="text-gray-500 font-normal">({r.year})</span>}
                      </p>
                      <p className="text-xs text-gray-500">
                        {r.type === "series" ? "TV Series" : "Movie"} • {r.language}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border flex-shrink-0 ${
                        STATUS_STYLES[r.status] || STATUS_STYLES.pending
                      }`}
                    >
                      {r.status || "pending"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}