// src/app/ServerBar.js : "Server: Main | Server 2 | Server 3 ..." under the player
export default function ServerBar({ servers, value, onChange }) {
  if (!servers || servers.length < 2) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap rounded-2xl bg-neutral-900/70 border border-white/10 px-3 sm:px-4 py-2.5">
      <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 mr-1">Server</span>
      {servers.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            value === s.id ? "bg-red-600 text-white shadow-lg shadow-red-600/30" : "bg-white/10 text-gray-300 hover:bg-white/20"
          }`}
        >
          {s.label}
        </button>
      ))}
      <span className="ml-auto text-[11px] text-gray-500 hidden sm:block">Not working? Try another server.</span>
    </div>
  );
}
