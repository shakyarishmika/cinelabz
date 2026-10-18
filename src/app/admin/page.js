"use client";

// src/app/admin/page.js  →  opens at  /admin
import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../useAuth";
import { isAdminEmail } from "../adminConfig";
import { movies as staticMovies } from "../moviesData";

// ---------- small helpers ----------
const inputCls =
  "w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-600/70 focus:ring-1 focus:ring-red-600/40 transition";
const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5";
const cardCls = "bg-neutral-900/70 border border-white/10 rounded-2xl";
const redBtn = "bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl px-4 py-2.5 text-sm transition cursor-pointer disabled:opacity-60";
const ghostBtn = "bg-white/10 hover:bg-white/20 border border-white/10 text-gray-200 font-semibold rounded-xl px-4 py-2.5 text-sm transition cursor-pointer";

const when = (ts) => (ts?.toDate ? ts.toDate().toLocaleString() : "—");
const secs = (ts) => ts?.seconds ?? 1e12; // pending server timestamps count as "newest"
const fail = (e) => alert(e?.code || e?.message || "Something went wrong");

const STATUSES = ["pending", "approved", "added", "rejected"];
const STATUS_STYLES = {
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  approved: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  added: "bg-green-500/15 text-green-400 border-green-500/30",
  rejected: "bg-red-500/15 text-red-400 border-red-500/30",
};

// "Server 1 | 1080p | 1.8 GB | https://..." (one per line)  <->  [{name, quality, size, url}]
function parseServers(text) {
  return (text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const p = line.split("|").map((x) => x.trim());
      const url = p[p.length - 1];
      if (!/^https?:\/\//i.test(url)) return null;
      return { name: p[0] && p[0] !== url ? p[0] : "Server", quality: p.length > 2 ? p[1] : "", size: p.length > 3 ? p[2] : "", url };
    })
    .filter(Boolean);
}
const serversToText = (list) =>
  (list || []).map((s) => [s.name, s.quality || "", s.size || "", s.url].join(" | ")).join("\n");

function Avatar({ name, photo, size = "w-10 h-10" }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`${size} rounded-full overflow-hidden bg-red-600 flex items-center justify-center text-sm font-bold flex-shrink-0`}>
      {photo && !failed ? (
        <img src={photo} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={() => setFailed(true)} />
      ) : (
        (name || "U").charAt(0).toUpperCase()
      )}
    </div>
  );
}

function Empty({ children }) {
  return <p className="text-sm text-gray-500 text-center py-10 bg-neutral-900/40 border border-white/5 rounded-2xl">{children}</p>;
}

// ======================================================================
// REQUESTS
// ======================================================================
function RequestsPanel({ items }) {
  const [filter, setFilter] = useState("all");
  const list = items.filter((r) => filter === "all" || (r.status || "pending") === filter);

  const setStatus = (id, status) => updateDoc(doc(db, "requests", id), { status }).catch(fail);
  const remove = (id) => window.confirm("Delete this request?") && deleteDoc(doc(db, "requests", id)).catch(fail);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {["all", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold capitalize whitespace-nowrap cursor-pointer transition ${
              filter === s ? "bg-red-600 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty>No requests here.</Empty>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id} className={`${cardCls} p-4 space-y-3`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold truncate">
                    {r.title} {r.year && <span className="text-gray-500 font-normal">({r.year})</span>}
                  </p>
                  <p className="text-xs text-gray-400">
                    {r.type === "series" ? "TV Series" : "Movie"} • {r.language} • {when(r.createdAt)}
                  </p>
                </div>
                <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border flex-shrink-0 ${STATUS_STYLES[r.status] || STATUS_STYLES.pending}`}>
                  {r.status || "pending"}
                </span>
              </div>
              {r.note && <p className="text-sm text-gray-300 bg-black/30 rounded-xl px-3 py-2 break-words">{r.note}</p>}
              <p className="text-xs text-gray-500 truncate">
                By {r.userName || "—"} • {r.userEmail || "—"}
              </p>
              <div className="flex gap-2">
                <select value={r.status || "pending"} onChange={(e) => setStatus(r.id, e.target.value)} className={`${inputCls} !w-auto flex-1`}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s} className="bg-neutral-900">
                      {s}
                    </option>
                  ))}
                </select>
                <button onClick={() => remove(r.id)} className="bg-red-600/15 text-red-400 hover:bg-red-600 hover:text-white rounded-xl px-4 text-sm font-bold transition cursor-pointer">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ======================================================================
// COMMENTS
// ======================================================================
function CommentsPanel({ items, titleName }) {
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase();
  const list = items.filter(
    (c) => !s || (c.text || "").toLowerCase().includes(s) || (c.userName || "").toLowerCase().includes(s) || (titleName[String(c.contentId)] || "").toLowerCase().includes(s)
  );
  const remove = (id) => window.confirm("Delete this comment?") && deleteDoc(doc(db, "comments", id)).catch(fail);

  return (
    <div className="space-y-4">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search comments, users, titles…" className={inputCls} />
      {list.length === 0 ? (
        <Empty>No comments.</Empty>
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.id} className={`${cardCls} p-4 flex gap-3`}>
              <Avatar name={c.userName} photo={c.photoURL} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-bold">{c.userName}</span> <span className="text-xs text-gray-500">{when(c.createdAt)}</span>
                </p>
                <p className="text-xs text-red-400 truncate">on {titleName[String(c.contentId)] || `#${c.contentId}`}</p>
                <p className="text-sm text-gray-300 mt-1 break-words whitespace-pre-wrap">{c.text}</p>
              </div>
              <button onClick={() => remove(c.id)} className="self-start bg-red-600/15 text-red-400 hover:bg-red-600 hover:text-white rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer">
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ======================================================================
// USERS
// ======================================================================
function UsersPanel({ items }) {
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase();
  const list = items.filter((u) => !s || (u.name || "").toLowerCase().includes(s) || (u.email || "").toLowerCase().includes(s));
  const toggle = (u) => updateDoc(doc(db, "users", u.id), { blocked: !u.blocked }).catch(fail);

  return (
    <div className="space-y-4">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className={inputCls} />
      <p className="text-xs text-gray-500">Users appear here after they sign in once. A blocked user can't comment or send requests.</p>
      {list.length === 0 ? (
        <Empty>No users yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {list.map((u) => (
            <li key={u.id} className={`${cardCls} p-4 flex items-center gap-3`}>
              <Avatar name={u.name || u.email} photo={u.photoURL} />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm truncate">
                  {u.name || "—"}{" "}
                  {u.blocked && <span className="ml-1 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full align-middle">BLOCKED</span>}
                </p>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
                <p className="text-[11px] text-gray-500">Last login: {when(u.lastLogin)}</p>
              </div>
              <button
                onClick={() => toggle(u)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                  u.blocked ? "bg-green-500/15 text-green-400 hover:bg-green-600 hover:text-white" : "bg-red-600/15 text-red-400 hover:bg-red-600 hover:text-white"
                }`}
              >
                {u.blocked ? "Unblock" : "Block"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ======================================================================
// TITLES: add / edit movie or series
// ======================================================================
function TitleForm({ initial, onDone }) {
  const edit = !!initial;
  const [f, setF] = useState(() => ({
    type: initial?.type || "movie",
    title: initial?.title || "",
    year: initial?.year ?? "",
    tmdbId: initial?.tmdbId ?? "",
    tmdbQuery: initial?.tmdbQuery || "",
    category: initial?.category || "",
    language: initial?.language || "English",
    quality: initial?.quality || "HD 1080p",
    status: initial?.status || "ongoing",
    rating: initial?.rating || "",
    image: initial?.image || "",
    sinhalaDescription: initial?.sinhalaDescription || "",
    videoUrl: initial?.videoUrl || "",
    subtitleUrl: initial?.subtitleUrl || "",
    servers: serversToText(initial?.downloads?.direct),
    telegramCode: initial?.downloads?.telegramCode || "",
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const isSeries = f.type === "series";

  const save = async (e) => {
    e.preventDefault();
    setErr("");
    if (f.title.trim().length < 2) return setErr("Enter a title.");
    if (!isSeries && !f.videoUrl.trim()) return setErr("Enter the video link for this movie.");

    const direct = parseServers(f.servers);
    const hasDownloads = direct.length > 0 || f.telegramCode.trim();
    const payload = {
      type: f.type,
      title: f.title.trim(),
      year: f.year ? Number(f.year) : null,
      tmdbId: f.tmdbId ? Number(f.tmdbId) : null,
      tmdbQuery: f.tmdbQuery.trim(),
      category: f.category.trim() || "General",
      language: f.language,
      quality: f.quality.trim() || "HD",
      rating: f.rating.trim() || "N/A",
      image: f.image.trim(),
      sinhalaDescription: f.sinhalaDescription.trim(),
      subtitleUrl: f.subtitleUrl.trim(),
      ...(isSeries
        ? { status: f.status }
        : {
            videoUrl: f.videoUrl.trim(),
            downloads: hasDownloads ? { direct, telegramCode: f.telegramCode.trim() } : null,
          }),
    };

    setSaving(true);
    try {
      if (edit) await updateDoc(doc(db, "titles", initial.id), payload);
      else await addDoc(collection(db, "titles"), { ...payload, ...(isSeries ? { seasons: [] } : {}), createdAt: serverTimestamp() });
      onDone(!edit && isSeries ? "episodes-next" : undefined);
    } catch (e2) {
      setErr(e2?.code || e2?.message || "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className={`${cardCls} p-5 space-y-4`}>
      <h3 className="font-black text-lg">{edit ? "Edit title" : "Add a new title"}</h3>

      <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
        {[
          ["movie", "🎬 Movie"],
          ["series", "📺 TV Series"],
        ].map(([val, label]) => (
          <button
            type="button"
            key={val}
            disabled={edit}
            onClick={() => setF((p) => ({ ...p, type: val }))}
            className={`py-2.5 rounded-lg text-sm font-bold transition ${f.type === val ? "bg-red-600 text-white" : "text-gray-400"} ${edit ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        <label className={labelCls}>Title *</label>
        <input value={f.title} onChange={set("title")} placeholder="e.g. Inception (2010) Sinhala Sub" className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>TMDB ID (best)</label>
          <input value={f.tmdbId} onChange={(e) => setF((p) => ({ ...p, tmdbId: e.target.value.replace(/\D/g, "") }))} inputMode="numeric" placeholder="27205" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Year</label>
          <input value={f.year} onChange={(e) => setF((p) => ({ ...p, year: e.target.value.replace(/\D/g, "").slice(0, 4) }))} inputMode="numeric" placeholder="2010" className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>TMDB search name (if no ID)</label>
        <input value={f.tmdbQuery} onChange={set("tmdbQuery")} placeholder="Inception" className={inputCls} />
        <p className="text-[11px] text-gray-500 mt-1">Poster, cast and description load from TMDB. The ID is the number in the themoviedb.org page URL.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Genres</label>
          <input value={f.category} onChange={set("category")} placeholder="Sci-Fi / Thriller" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Language</label>
          <select value={f.language} onChange={set("language")} className={inputCls}>
            {["English", "Tamil", "Hindi", "Kannada", "Korean", "Sinhala", "Other"].map((l) => (
              <option key={l} value={l} className="bg-neutral-900">
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Quality label</label>
          <input value={f.quality} onChange={set("quality")} placeholder="HD 1080p" className={inputCls} />
        </div>
        {isSeries ? (
          <div>
            <label className={labelCls}>Series status</label>
            <select value={f.status} onChange={set("status")} className={inputCls}>
              <option value="ongoing" className="bg-neutral-900">Ongoing</option>
              <option value="completed" className="bg-neutral-900">Completed</option>
            </select>
          </div>
        ) : (
          <div>
            <label className={labelCls}>Rating (fallback)</label>
            <input value={f.rating} onChange={set("rating")} placeholder="8.5/10" className={inputCls} />
          </div>
        )}
      </div>

      <div>
        <label className={labelCls}>Sinhala description</label>
        <textarea value={f.sinhalaDescription} onChange={set("sinhalaDescription")} rows={3} className={`${inputCls} resize-none`} />
      </div>

      <div>
        <label className={labelCls}>Poster image URL (only if TMDB can't find it)</label>
        <input value={f.image} onChange={set("image")} placeholder="https://…" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Subtitle (.vtt) URL</label>
        <input value={f.subtitleUrl} onChange={set("subtitleUrl")} placeholder="https://…/sinhala.vtt" className={inputCls} />
      </div>

      {isSeries ? (
        <p className="text-xs text-gray-400 bg-black/30 border border-white/10 rounded-xl px-4 py-3">
          After saving, use <b>Episodes</b> to add seasons and episodes (video link + downloads per episode).
        </p>
      ) : (
        <>
          <div>
            <label className={labelCls}>Video link * (mp4 or mega.nz/embed)</label>
            <input value={f.videoUrl} onChange={set("videoUrl")} placeholder="https://…" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Direct download servers</label>
            <textarea
              value={f.servers}
              onChange={set("servers")}
              rows={3}
              placeholder={"Server 1 | 1080p | 1.8 GB | https://…\nServer 2 | 720p | 900 MB | https://…"}
              className={`${inputCls} resize-none font-mono text-xs`}
            />
            <p className="text-[11px] text-gray-500 mt-1">One per line: Name | Quality | Size | Link</p>
          </div>
          <div>
            <label className={labelCls}>Telegram code</label>
            <input value={f.telegramCode} onChange={set("telegramCode")} placeholder="m_inception" className={inputCls} />
            <p className="text-[11px] text-gray-500 mt-1">Same code as in your bot's files.json</p>
          </div>
        </>
      )}

      {err && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{err}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className={`${redBtn} flex-1`}>
          {saving ? "Saving…" : edit ? "Save changes" : "Add title"}
        </button>
        <button type="button" onClick={() => onDone()} className={ghostBtn}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ======================================================================
// TITLES: seasons + episodes of one series
// ======================================================================
function EpisodesManager({ title, onBack }) {
  const blank = { season: "1", ep: "1", name: "", duration: "", videoUrl: "", subtitleUrl: "", servers: "", telegramCode: "" };
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const seasons = title.seasons || [];

  const save = async (e) => {
    e.preventDefault();
    setErr("");
    const sNo = parseInt(f.season, 10);
    const eNo = parseInt(f.ep, 10);
    if (!(sNo >= 1) || !(eNo >= 1)) return setErr("Season and episode numbers must be 1 or more.");
    if (!f.videoUrl.trim()) return setErr("Enter the episode video link.");

    const direct = parseServers(f.servers);
    const episode = {
      number: eNo,
      title: f.name.trim() || `Episode ${eNo}`,
      duration: f.duration.trim(),
      videoUrl: f.videoUrl.trim(),
      subtitleUrl: f.subtitleUrl.trim(),
      downloads: direct.length || f.telegramCode.trim() ? { direct, telegramCode: f.telegramCode.trim() } : null,
    };

    const next = seasons.map((s) => ({ ...s, episodes: [...s.episodes] }));
    let season = next.find((s) => s.number === sNo);
    if (!season) {
      season = { number: sNo, episodes: [] };
      next.push(season);
    }
    const i = season.episodes.findIndex((x) => x.number === eNo);
    if (i >= 0) season.episodes[i] = episode;
    else season.episodes.push(episode);
    season.episodes.sort((a, b) => a.number - b.number);
    next.sort((a, b) => a.number - b.number);

    setSaving(true);
    try {
      await updateDoc(doc(db, "titles", title.id), { seasons: next });
      setF({ ...blank, season: String(sNo), ep: String(eNo + 1) }); // ready for the next episode
    } catch (e2) {
      setErr(e2?.code || e2?.message || "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const removeEp = (sNo, eNo) => {
    if (!window.confirm(`Delete S${sNo} E${eNo}?`)) return;
    const next = seasons
      .map((s) => (s.number === sNo ? { ...s, episodes: s.episodes.filter((x) => x.number !== eNo) } : s))
      .filter((s) => s.episodes.length > 0);
    updateDoc(doc(db, "titles", title.id), { seasons: next }).catch(fail);
  };

  const loadEp = (sNo, ep) =>
    setF({
      season: String(sNo),
      ep: String(ep.number),
      name: ep.title || "",
      duration: ep.duration || "",
      videoUrl: ep.videoUrl || "",
      subtitleUrl: ep.subtitleUrl || "",
      servers: serversToText(ep.downloads?.direct),
      telegramCode: ep.downloads?.telegramCode || "",
    });

  return (
    <div className="space-y-5">
      <button onClick={onBack} className={ghostBtn}>
        ← Back to titles
      </button>
      <h3 className="font-black text-lg truncate">Episodes: {title.title}</h3>

      {seasons.length === 0 ? (
        <Empty>No episodes yet. Add the first one below.</Empty>
      ) : (
        seasons.map((s) => (
          <div key={s.number} className={`${cardCls} p-4 space-y-2`}>
            <p className="text-xs font-bold uppercase tracking-wider text-red-400">Season {s.number}</p>
            <ul className="space-y-1.5">
              {s.episodes.map((ep) => (
                <li key={ep.number} className="flex items-center gap-3 bg-black/30 rounded-xl px-3 py-2">
                  <span className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 text-sm font-black flex items-center justify-center flex-shrink-0">{ep.number}</span>
                  <span className="text-sm truncate flex-1">{ep.title}</span>
                  <button onClick={() => loadEp(s.number, ep)} className="text-xs text-gray-300 hover:text-white cursor-pointer">Edit</button>
                  <button onClick={() => removeEp(s.number, ep.number)} className="text-xs text-red-400 hover:text-red-300 cursor-pointer">Delete</button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      <form onSubmit={save} className={`${cardCls} p-5 space-y-4`}>
        <h4 className="font-bold">Add / update an episode</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Season *</label>
            <input value={f.season} onChange={(e) => setF((p) => ({ ...p, season: e.target.value.replace(/\D/g, "") }))} inputMode="numeric" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Episode *</label>
            <input value={f.ep} onChange={(e) => setF((p) => ({ ...p, ep: e.target.value.replace(/\D/g, "") }))} inputMode="numeric" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Episode title</label>
            <input value={f.name} onChange={set("name")} placeholder="Pilot" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Duration</label>
            <input value={f.duration} onChange={set("duration")} placeholder="45m" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Video link * (mp4 or mega.nz/embed)</label>
          <input value={f.videoUrl} onChange={set("videoUrl")} placeholder="https://…" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Subtitle (.vtt) URL</label>
          <input value={f.subtitleUrl} onChange={set("subtitleUrl")} placeholder="https://…" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Direct download servers</label>
          <textarea value={f.servers} onChange={set("servers")} rows={3} placeholder={"Server 1 | 720p | 400 MB | https://…"} className={`${inputCls} resize-none font-mono text-xs`} />
        </div>
        <div>
          <label className={labelCls}>Telegram code</label>
          <input value={f.telegramCode} onChange={set("telegramCode")} placeholder="show_s1e1" className={inputCls} />
        </div>
        {err && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{err}</p>}
        <button type="submit" disabled={saving} className={`${redBtn} w-full`}>
          {saving ? "Saving…" : "Save episode"}
        </button>
      </form>
    </div>
  );
}

function TitlesPanel({ items }) {
  const [view, setView] = useState({ mode: "list" }); // list | form | episodes
  const current = view.id ? items.find((t) => t.id === view.id) : null;

  const remove = (t) =>
    window.confirm(`Delete "${t.title}" and all its episodes?`) && deleteDoc(doc(db, "titles", t.id)).catch(fail);

  if (view.mode === "form") {
    return (
      <TitleForm
        initial={current}
        onDone={(next) => {
          // after adding a new series, jump to its episodes (newest title is first)
          if (next === "episodes-next") setView({ mode: "list", jumpNewest: true });
          else setView({ mode: "list" });
        }}
      />
    );
  }
  if (view.mode === "episodes" && current) {
    return <EpisodesManager title={current} onBack={() => setView({ mode: "list" })} />;
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setView({ mode: "form" })} className={`${redBtn} w-full`}>
        + Add movie / TV series
      </button>
      {view.jumpNewest && items[0]?.type === "series" && (
        <button onClick={() => setView({ mode: "episodes", id: items[0].id })} className="w-full bg-green-500/15 text-green-400 border border-green-500/30 rounded-xl px-4 py-3 text-sm font-bold cursor-pointer">
          ✓ Series saved. Add its episodes now →
        </button>
      )}
      <p className="text-xs text-gray-500">Titles added here appear on the site straight away. Titles from moviesData.js are not editable here.</p>

      {items.length === 0 ? (
        <Empty>No titles added from the admin panel yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {items.map((t) => (
            <li key={t.id} className={`${cardCls} p-4 space-y-3`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold truncate">{t.title}</p>
                  <p className="text-xs text-gray-400">
                    {t.type === "series" ? `TV Series • ${t.status || "ongoing"} • ${(t.seasons || []).reduce((n, s) => n + s.episodes.length, 0)} episodes` : "Movie"} • {t.language}
                  </p>
                </div>
                <span className="text-[11px] text-gray-500 flex-shrink-0">{when(t.createdAt)}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {t.type === "series" && (
                  <button onClick={() => setView({ mode: "episodes", id: t.id })} className={redBtn}>
                    Episodes
                  </button>
                )}
                <button onClick={() => setView({ mode: "form", id: t.id })} className={ghostBtn}>
                  Edit
                </button>
                <a href={`/?movie=${t.id}`} target="_blank" rel="noopener noreferrer" className={ghostBtn}>
                  View
                </a>
                <button onClick={() => remove(t)} className="bg-red-600/15 text-red-400 hover:bg-red-600 hover:text-white rounded-xl px-4 text-sm font-bold transition cursor-pointer">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ======================================================================
// PAGE
// ======================================================================
export default function AdminPage() {
  const { user, loading, error, signIn, signOutUser } = useAuth();
  const isAdmin = !!user && isAdminEmail(user.email);

  const [tab, setTab] = useState("dashboard");
  const [data, setData] = useState({ requests: [], comments: [], users: [], titles: [] });
  const [dbError, setDbError] = useState("");

  // Live data (only after we know this is the admin)
  useEffect(() => {
    if (!isAdmin || !db) return;
    const unsubs = ["requests", "comments", "users", "titles"].map((name) =>
      onSnapshot(
        collection(db, name),
        (snap) => setData((p) => ({ ...p, [name]: snap.docs.map((d) => ({ ...d.data(), id: d.id })) })),
        (err) => setDbError(`${name}: ${err.code}`)
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [isAdmin]);

  const requests = useMemo(() => [...data.requests].sort((a, b) => secs(b.createdAt) - secs(a.createdAt)), [data.requests]);
  const comments = useMemo(() => [...data.comments].sort((a, b) => secs(b.createdAt) - secs(a.createdAt)), [data.comments]);
  const users = useMemo(() => [...data.users].sort((a, b) => secs(b.lastLogin) - secs(a.lastLogin)), [data.users]);
  const titles = useMemo(() => [...data.titles].sort((a, b) => secs(b.createdAt) - secs(a.createdAt)), [data.titles]);
  const titleName = useMemo(() => {
    const m = {};
    staticMovies.forEach((x) => (m[String(x.id)] = x.title));
    data.titles.forEach((x) => (m[String(x.id)] = x.title));
    return m;
  }, [data.titles]);

  const pending = requests.filter((r) => (r.status || "pending") === "pending").length;

  // ----- gates -----
  const Shell = ({ children }) => (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans flex items-center justify-center p-4">{children}</div>
  );

  if (loading) return <Shell><p className="text-gray-400 text-sm">Loading…</p></Shell>;

  if (!user)
    return (
      <Shell>
        <div className={`${cardCls} p-8 max-w-sm w-full text-center space-y-4`}>
          <div className="mx-auto w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center text-2xl">🛠️</div>
          <h1 className="text-2xl font-black">CineLabz Admin</h1>
          <p className="text-sm text-gray-400">Sign in with the admin Google account.</p>
          <button onClick={signIn} className={`${redBtn} w-full`}>Continue with Google</button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </Shell>
    );

  if (!isAdmin)
    return (
      <Shell>
        <div className={`${cardCls} p-8 max-w-sm w-full text-center space-y-4`}>
          <h1 className="text-xl font-black">Access denied</h1>
          <p className="text-sm text-gray-400 break-words">{user.email} is not an admin account.</p>
          <div className="flex gap-3 justify-center">
            <a href="/" className={ghostBtn}>Back to site</a>
            <button onClick={signOutUser} className={redBtn}>Sign out</button>
          </div>
        </div>
      </Shell>
    );

  const tabs = [
    ["dashboard", "Dashboard"],
    ["requests", `Requests${pending ? ` (${pending})` : ""}`],
    ["comments", "Comments"],
    ["users", "Users"],
    ["titles", "Movies & Series"],
  ];

  const tiles = [
    ["Users", users.length, "users"],
    ["Pending requests", pending, "requests"],
    ["Comments", comments.length, "comments"],
    ["Added titles", titles.length, "titles"],
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      <header className="sticky top-0 z-30 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <h1 className="font-black text-lg mr-auto">
            <span className="text-red-600">Cine</span>Labz Admin
          </h1>
          <a href="/" className="text-xs text-gray-300 hover:text-white">← Site</a>
          <Avatar name={user.displayName || user.email} photo={user.photoURL} size="w-8 h-8" />
          <button onClick={signOutUser} className="text-xs text-red-400 hover:text-red-300 cursor-pointer">Sign out</button>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap cursor-pointer transition ${
                tab === id ? "bg-red-600 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-20 space-y-5">
        {dbError && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            Can't load ({dbError}). Publish firestore.rules and check the admin email matches in both places.
          </p>
        )}

        {tab === "dashboard" && (
          <div className="grid grid-cols-2 gap-3">
            {tiles.map(([label, n, go]) => (
              <button key={label} onClick={() => setTab(go)} className={`${cardCls} p-5 text-left hover:border-red-600/50 transition cursor-pointer`}>
                <p className="text-3xl font-black">{n}</p>
                <p className="text-xs text-gray-400 mt-1">{label}</p>
              </button>
            ))}
          </div>
        )}
        {tab === "requests" && <RequestsPanel items={requests} />}
        {tab === "comments" && <CommentsPanel items={comments} titleName={titleName} />}
        {tab === "users" && <UsersPanel items={users} />}
        {tab === "titles" && <TitlesPanel items={titles} />}
      </main>
    </div>
  );
}