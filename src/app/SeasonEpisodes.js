"use client";

// seasons = [{ number: 1, episodes: [{ number: 1, title: "Pilot", videoUrl, videoLinks, downloads }] }]
export default function SeasonEpisodes({ seasons, seasonNo, episodeNo, onSeason, onEpisode }) {
  if (!seasons?.length) return null;
  const season = seasons.find((s) => s.number === seasonNo) || seasons[0];

  return (
    <div className="bg-neutral-900/60 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-gray-200">Episodes</h3>
        <div className="flex items-center gap-2 bg-black/40 border border-white/10 px-3 py-2 rounded-xl">
          <label htmlFor="season-select" className="text-xs text-gray-400 font-bold">
            Season
          </label>
          <select
            id="season-select"
            value={season.number}
            onChange={(e) => onSeason(Number(e.target.value))}
            className="bg-transparent text-red-500 font-bold text-sm focus:outline-none cursor-pointer"
          >
            {seasons.map((s) => (
              <option key={s.number} value={s.number} className="bg-neutral-900 text-white">
                Season {s.number}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
        {season.episodes.map((ep) => {
          const active = ep.number === episodeNo;
          return (
            <li key={ep.number}>
              <button
                onClick={() => onEpisode(ep.number)}
                aria-current={active ? "true" : undefined}
                className={`w-full flex items-center gap-3 text-left px-3 py-3 rounded-xl border transition cursor-pointer ${
                  active
                    ? "bg-red-600/20 border-red-600/60"
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0 ${
                    active ? "bg-red-600 text-white" : "bg-black/40 text-gray-300"
                  }`}
                >
                  {ep.number}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold truncate">{ep.title || `Episode ${ep.number}`}</span>
                  {ep.duration && <span className="block text-xs text-gray-500">{ep.duration}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
