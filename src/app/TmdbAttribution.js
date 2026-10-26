"use client";

// src/app/TmdbAttribution.js : the TMDB logo + attribution, shown just above the footer.
// TMDB asks that the logo is smaller than your own logo and that this sentence is shown.
// Put the official logo file at  public/tmdb-logo.svg  (download it from
// https://www.themoviedb.org/about/logos-attribution). Until then a text version is shown.
import { useState } from "react";

export default function TmdbAttribution() {
  const [failed, setFailed] = useState(false);
  return (
    <section className="max-w-7xl w-full mx-auto px-6 pt-12 pb-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#0d253f]/70 via-neutral-900/70 to-[#01b4e4]/10 p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[#01b4e4]/15 blur-3xl" />
        <div className="relative flex flex-col md:flex-row items-center gap-5 md:gap-8 text-center md:text-left">
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="The Movie Database (TMDB)"
            className="flex-shrink-0 opacity-90 hover:opacity-100 transition"
          >
            {failed ? (
              <span
                className="text-xl font-black tracking-[0.25em]"
                style={{ background: "linear-gradient(90deg,#90cea1,#3cbec9,#00b3e5)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
              >
                TMDB
              </span>
            ) : (
              <img src="/tmdb-logo.svg" alt="TMDB" className="h-4 sm:h-5 w-auto" onError={() => setFailed(true)} />
            )}
          </a>
          <div className="hidden md:block w-px h-10 bg-white/10" />
          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-2xl">
            This product uses the TMDB API but is not endorsed or certified by TMDB. Movie &amp; TV details, posters and cast photos are provided by{" "}
            <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="text-[#01b4e4] hover:underline">
              The Movie Database
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
