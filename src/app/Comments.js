"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "./firebase";

function timeAgo(ts) {
  if (!ts?.seconds) return "just now";
  const s = Math.floor(Date.now() / 1000 - ts.seconds);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Avatar({ name, photo }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="w-9 h-9 rounded-full overflow-hidden bg-red-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
      {photo && !failed ? (
        <img src={photo} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={() => setFailed(true)} />
      ) : (
        (name || "U").charAt(0).toUpperCase()
      )}
    </div>
  );
}

// contentId = movie / series id. user comes from useAuth().
export default function Comments({ contentId, user, authLoading, onSignIn }) {
  const [list, setList] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Live comments for this title
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "comments"), where("contentId", "==", String(contentId)));
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (b.createdAt?.seconds ?? Infinity) - (a.createdAt?.seconds ?? Infinity));
        setList(rows);
      },
      (err) => console.error("Comments listener error:", err)
    );
  }, [contentId]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!user) return onSignIn();
    const clean = text.trim();
    if (clean.length < 2) return setError("Write a comment first.");
    setSending(true);
    try {
      await addDoc(collection(db, "comments"), {
        contentId: String(contentId),
        uid: user.uid,
        userName: user.displayName || "CineLabz user",
        photoURL: user.photoURL || "",
        text: clean.slice(0, 500),
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (err) {
      console.error(err);
      setError("Couldn't post your comment. Try again.");
    } finally {
      setSending(false);
    }
  };

  const remove = async (id) => {
    try {
      await deleteDoc(doc(db, "comments", id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <section className="bg-neutral-900/60 border border-white/10 p-5 sm:p-8 rounded-3xl space-y-5">
      <h3 className="text-lg font-bold">
        Comments <span className="text-gray-500 text-sm font-normal">({list.length})</span>
      </h3>

      {!db ? (
        <p className="text-sm text-yellow-400">Comments need Firebase keys — see FIREBASE_SETUP.md.</p>
      ) : authLoading ? (
        <div className="h-20 rounded-2xl bg-white/5 animate-pulse" />
      ) : user ? (
        <form onSubmit={submit} className="flex gap-3">
          <Avatar name={user.displayName || user.email} photo={user.photoURL} />
          <div className="flex-1 space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Add a comment…"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-600/70 resize-none"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-red-400">{error}</span>
              <button
                type="submit"
                disabled={sending}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-5 py-2 rounded-xl text-sm font-bold cursor-pointer transition"
              >
                {sending ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-black/30 border border-white/10 rounded-2xl p-4">
          <p className="text-sm text-gray-300 sm:mr-auto">Sign in to join the conversation.</p>
          <button
            onClick={onSignIn}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition"
          >
            Sign In
          </button>
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No comments yet. Be the first.</p>
      ) : (
        <ul className="space-y-4">
          {list.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.userName} photo={c.photoURL} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-bold">{c.userName}</span>{" "}
                  <span className="text-xs text-gray-500">{timeAgo(c.createdAt)}</span>
                </p>
                <p className="text-sm text-gray-300 mt-0.5 break-words whitespace-pre-wrap">{c.text}</p>
                {user?.uid === c.uid && (
                  <button onClick={() => remove(c.id)} className="text-xs text-gray-500 hover:text-red-400 mt-1 cursor-pointer">
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
