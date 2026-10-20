"use client";

// Comments with reply. Replies from the admin show the AdminLogo.png in a red ring + "Admin" badge.
import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "./firebase";
import { isAdminEmail } from "./adminConfig";

function timeAgo(ts) {
  if (!ts?.seconds) return "just now";
  const s = Math.floor(Date.now() / 1000 - ts.seconds);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// c = { userName, photoURL, isAdmin }
function Avatar({ c, size = "w-9 h-9" }) {
  const [failed, setFailed] = useState(false);
  if (c.isAdmin) {
    return (
      <div className={`${size} rounded-full overflow-hidden bg-neutral-900 border-2 border-red-600 shadow-md shadow-red-600/30 flex items-center justify-center text-xs font-black text-red-500 flex-shrink-0`}>
        {failed ? "A" : <img src="/AdminLogo.png" alt="Admin" className="w-full h-full object-cover" onError={() => setFailed(true)} />}
      </div>
    );
  }
  return (
    <div className={`${size} rounded-full overflow-hidden bg-red-600 flex items-center justify-center text-sm font-bold flex-shrink-0`}>
      {c.photoURL && !failed ? (
        <img src={c.photoURL} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={() => setFailed(true)} />
      ) : (
        (c.userName || "U").charAt(0).toUpperCase()
      )}
    </div>
  );
}

const AdminBadge = () => (
  <span className="ml-1.5 text-[10px] font-black uppercase tracking-wider bg-red-600 text-white px-1.5 py-0.5 rounded-md align-middle">Admin</span>
);

// contentId = movie / series id. user comes from useAuth().
export default function Comments({ contentId, user, authLoading, onSignIn }) {
  const [list, setList] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [replyTo, setReplyTo] = useState(null); // { rootId, toId, name }
  const [replyText, setReplyText] = useState("");
  const [hidden, setHidden] = useState({}); // rootId -> replies collapsed
  const admin = !!user && isAdminEmail(user.email);

  // Live comments for this title (comments + replies)
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "comments"), where("contentId", "==", String(contentId)));
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (b.createdAt?.seconds ?? 1e12) - (a.createdAt?.seconds ?? 1e12));
        setList(rows);
      },
      (err) => {
        console.error("Comments listener error:", err);
        setLoadError(err.code || "unknown");
      }
    );
  }, [contentId]);

  const roots = useMemo(() => list.filter((c) => !c.parentId), [list]);
  const repliesOf = useMemo(() => {
    const m = {};
    list
      .filter((c) => c.parentId)
      .sort((a, b) => (a.createdAt?.seconds ?? 1e12) - (b.createdAt?.seconds ?? 1e12)) // oldest first
      .forEach((c) => (m[c.parentId] = [...(m[c.parentId] || []), c]));
    return m;
  }, [list]);

  const post = async (body, parentId, replyToName) => {
    await addDoc(collection(db, "comments"), {
      contentId: String(contentId),
      uid: user.uid,
      userName: admin ? "Admin" : user.displayName || "CineLabz user",
      photoURL: admin ? "" : user.photoURL || "",
      ...(admin ? { isAdmin: true } : {}),
      ...(parentId ? { parentId } : {}),
      ...(replyToName ? { replyToName } : {}),
      text: body.slice(0, 500),
      createdAt: serverTimestamp(),
    });
  };

  const explain = (err) =>
    err.code === "permission-denied"
      ? "Firestore rules are blocking comments. Publish the latest firestore.rules."
      : `Couldn't post (${err.code || "error"}).`;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!user) return onSignIn();
    const clean = text.trim();
    if (clean.length < 2) return setError("Write a comment first.");
    setSending(true);
    try {
      await post(clean, null, "");
      setText("");
    } catch (err) {
      console.error(err);
      setError(explain(err));
    } finally {
      setSending(false);
    }
  };

  const startReply = (c, rootId) => {
    if (!user) return onSignIn();
    setError("");
    setReplyTo({ rootId, toId: c.id, name: c.userName });
    setReplyText("");
  };

  const sendReply = async (e) => {
    e.preventDefault();
    const clean = replyText.trim();
    if (!clean || !replyTo) return;
    setSending(true);
    setError("");
    try {
      await post(clean, replyTo.rootId, replyTo.toId !== replyTo.rootId ? replyTo.name : "");
      setReplyTo(null);
      setReplyText("");
      setHidden((h) => ({ ...h, [replyTo.rootId]: false }));
    } catch (err) {
      console.error(err);
      setError(explain(err));
    } finally {
      setSending(false);
    }
  };

  const remove = async (c) => {
    try {
      // admin deleting a comment also removes its replies
      const kids = admin && !c.parentId ? repliesOf[c.id] || [] : [];
      await Promise.all([deleteDoc(doc(db, "comments", c.id)), ...kids.map((k) => deleteDoc(doc(db, "comments", k.id)))]);
    } catch (err) {
      console.error(err);
    }
  };

  const renderOne = (c, rootId, isReply) => (
    <div className="flex gap-3">
      <Avatar c={c} size={isReply ? "w-8 h-8" : "w-9 h-9"} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-bold">{c.userName}</span>
          {c.isAdmin && <AdminBadge />} <span className="text-xs text-gray-500">{timeAgo(c.createdAt)}</span>
        </p>
        {isReply && c.replyToName && <p className="text-[11px] text-gray-500">↪ replying to {c.replyToName}</p>}
        <p className="text-sm text-gray-300 mt-0.5 break-words whitespace-pre-wrap">{c.text}</p>
        <div className="flex items-center gap-4 mt-1">
          <button onClick={() => startReply(c, rootId)} className="text-xs text-gray-400 hover:text-white cursor-pointer">
            Reply
          </button>
          {(user?.uid === c.uid || admin) && (
            <button onClick={() => remove(c)} className="text-xs text-gray-500 hover:text-red-400 cursor-pointer">
              Delete
            </button>
          )}
        </div>

        {replyTo?.toId === c.id && (
          <form onSubmit={sendReply} className="mt-2 space-y-2">
            <textarea
              autoFocus
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder={`Reply to ${c.userName}…`}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-600/70 resize-none"
            />
            <div className="flex items-center gap-2">
              <button type="submit" disabled={sending} className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition">
                {sending ? "Sending…" : "Reply"}
              </button>
              <button type="button" onClick={() => setReplyTo(null)} className="bg-white/10 hover:bg-white/20 px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition">
                Cancel
              </button>
              <span className="text-xs text-red-400">{error}</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <section className="bg-neutral-900/60 border border-white/10 p-5 sm:p-8 rounded-3xl space-y-5">
      <h3 className="text-lg font-bold">
        Comments <span className="text-gray-500 text-sm font-normal">({list.length})</span>
      </h3>

      {loadError && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {loadError === "permission-denied"
            ? "Can't load comments: Firestore rules are blocking the 'comments' collection. Publish the latest firestore.rules."
            : `Can't load comments (${loadError}).`}
        </p>
      )}

      {!db ? (
        <p className="text-sm text-yellow-400">Comments need Firebase keys — see FIREBASE_SETUP.md.</p>
      ) : authLoading ? (
        <div className="h-20 rounded-2xl bg-white/5 animate-pulse" />
      ) : user ? (
        <form onSubmit={submit} className="flex gap-3">
          <Avatar c={{ userName: user.displayName || user.email, photoURL: user.photoURL, isAdmin: admin }} />
          <div className="flex-1 space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder={admin ? "Comment as Admin…" : "Add a comment…"}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-600/70 resize-none"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-red-400">{replyTo ? "" : error}</span>
              <button type="submit" disabled={sending} className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-5 py-2 rounded-xl text-sm font-bold cursor-pointer transition">
                {sending ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-black/30 border border-white/10 rounded-2xl p-4">
          <p className="text-sm text-gray-300 sm:mr-auto">Sign in to join the conversation.</p>
          <button onClick={onSignIn} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition">
            Sign In
          </button>
        </div>
      )}

      {roots.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No comments yet. Be the first.</p>
      ) : (
        <ul className="space-y-5">
          {roots.map((c) => {
            const replies = repliesOf[c.id] || [];
            return (
              <li key={c.id}>
                {renderOne(c, c.id, false)}
                {replies.length > 0 && (
                  <div className="ml-12 mt-2">
                    <button onClick={() => setHidden((h) => ({ ...h, [c.id]: !h[c.id] }))} className="text-xs font-semibold text-red-400 hover:text-red-300 cursor-pointer">
                      {hidden[c.id] ? "▸" : "▾"} {replies.length} {replies.length === 1 ? "reply" : "replies"}
                    </button>
                    {!hidden[c.id] && (
                      <div className="mt-3 pl-4 border-l-2 border-white/10 space-y-4">
                        {replies.map((r) => (
                          <div key={r.id}>{renderOne(r, c.id, true)}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}