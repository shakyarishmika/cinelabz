"use client";

// src/app/RecentUploads.js : "Recently uploaded" row. Swipe sideways on a phone, arrows on a computer.
import { useRef } from "react";

const WEEK = 7 * 24 * 3600;

export default function RecentUploads({ items, onSelect, fallback, title = "Recently uploaded" }) {
  const rowRef = useRef(null);
  if (!items?.length) return null;
  const now = Date.now() / 1000;
  const scroll = (dir) => rowRef.current?.scrollBy({ left: dir * Math.max(300, rowRef.current.clientWidth * 0.8), behavior: "smooth" });

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-7 rounded-full bg-gradient-to-b from-red-500 to-red-800" />
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">{title}</h2>
            <p className="text-xs text-gray-500">Swipe to see more →</p>
          </div>
        </div>
        <div className="hidden sm:flex gap-2">
          <button onClick={() => scroll(-1)} aria-label="Previous" className="w-10 h-10 rounded-full bg-white/10 hover:bg-red-600 border border-white/10 flex items-center justify-center transition cursor-pointer">
            ‹
          </button>
          <button onClick={() => scroll(1)} aria-label="Next" className="w-10 h-10 rounded-full bg-white/10 hover:bg-red-600 border border-white/10 flex items-center justify-center transition cursor-pointer">
            ›
          </button>
        </div>
      </div>

      <div
        ref={rowRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 -mx-4 px-4 sm:mx-0 sm:px-0"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map((item) => {
          const isNew = item.createdAt?.seconds ? now - item.createdAt.seconds < WEEK : false;
          return (
            <button key={item.id} onClick={() => onSelect(item)} className="snap-start flex-shrink-0 w-36 sm:w-44 group text-left cursor-pointer">
              <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-neutral-800 border border-white/10 group-hover:border-red-600/60 shadow-lg transition">
                <img
                  src={item.poster || fallback}
                  alt={item.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    if (fallback && e.target.src !== fallback) e.target.src = fallback;
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 to-transparent" />
                {isNew && <span className="absolute top-2 left-2 bg-red-600 text-[10px] font-black px-2 py-0.5 rounded-full shadow">NEW</span>}
                {item.rating && <span className="absolute top-2 right-2 bg-black/70 text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded-full">⭐ {item.rating}</span>}
                <span className="absolute bottom-2 left-2 text-[10px] font-bold uppercase tracking-wider text-white/80">{item.type === "series" ? "TV Series" : "Movie"}</span>
              </div>
              <p className="mt-2 text-xs sm:text-sm font-semibold truncate group-hover:text-red-500 transition">{item.title}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
