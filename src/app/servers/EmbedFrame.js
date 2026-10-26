// src/app/servers/EmbedFrame.js : a ready-made frame the default Server 2 / 3 / 4 use.
// You can keep using it inside your own code, or ignore it.
export default function EmbedFrame({ url, title }) {
  return (
    <div className="relative aspect-video bg-black -mx-4 sm:mx-0 rounded-none sm:rounded-3xl overflow-hidden shadow-2xl border-y sm:border border-white/10">
      <iframe
        src={url}
        title={title || "Player"}
        className="w-full h-full border-0"
        allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
