"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { movies as baseMovies, trendingMovieIds, trendingSeriesIds, heroCount } from "./moviesData";
import { useAuth } from "./useAuth";
import SignInModal from "./SignInModal";
import RequestPage from "./RequestPage";

// ---------- TMDB config ----------
// .env.local එකේ NEXT_PUBLIC_TMDB_API_KEY=xxxx දාන එක හොඳයි. නැත්නම් පහල key එක පාවිච්චි වෙනවා.
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "11b62acb01b14ccb50539617ec367524";
const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

const FALLBACK_POSTER = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80";
const FALLBACK_ACTOR = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80";

// CineLabz logo — logo.png එක project එකේ `public/` folder එකට දාන්න (public/logo.png).
// File එක නැත්නම් auto emoji badge + text fallback එක පෙන්නනවා.
const LOGO_SRC = "/logo.png";

// Items per page on the home / collection grid
const PAGE_SIZE = 20;

// Footer social links — ඔයාගේ real links මෙතන දාන්න
const SOCIAL_LINKS = [
  {
    name: "Facebook",
    href: "https://facebook.com/",
    hover: "hover:bg-[#1877F2] hover:shadow-[#1877F2]/40",
    icon: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    href: "https://instagram.com/",
    hover: "hover:bg-gradient-to-tr hover:from-[#f9a825] hover:via-[#e1306c] hover:to-[#833ab4] hover:shadow-[#e1306c]/40",
    icon: (
      <svg className="w-5 h-5 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" className="fill-current stroke-none" />
      </svg>
    ),
  },
  {
    name: "GitHub",
    href: "https://github.com/",
    hover: "hover:bg-[#333] hover:shadow-white/20",
    icon: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.82 1.19 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
      </svg>
    ),
  },
];

const onImgError = (fallback) => (e) => {
  if (e.target.src !== fallback) e.target.src = fallback;
};

// Resolve tmdbId (given or via search) and fetch details + credits in one request
async function fetchTmdbData(item) {
  const kind = item.type === "movie" ? "movie" : "tv";
  let id = item.tmdbId;

  if (!id) {
    const q = encodeURIComponent(item.tmdbQuery || item.title);
    const yearParam = item.year
      ? kind === "movie"
        ? `&primary_release_year=${item.year}`
        : `&first_air_date_year=${item.year}`
      : "";
    let res = await fetch(`${TMDB}/search/${kind}?api_key=${TMDB_API_KEY}&query=${q}${yearParam}`).then((r) => r.json());
    if (!res.results?.length && yearParam) {
      res = await fetch(`${TMDB}/search/${kind}?api_key=${TMDB_API_KEY}&query=${q}`).then((r) => r.json());
    }
    id = res.results?.[0]?.id;
    if (!id) return null;
  }

  const d = await fetch(`${TMDB}/${kind}/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits`).then((r) => r.json());
  if (!d || d.success === false) return null;

  return {
    tmdbId: id,
    poster: d.poster_path ? `${IMG}/w500${d.poster_path}` : null,
    backdrop: d.backdrop_path ? `${IMG}/w1280${d.backdrop_path}` : null,
    overview: d.overview || "",
    rating: d.vote_average ? `${d.vote_average.toFixed(1)}/10` : null,
    genres: (d.genres || []).map((g) => g.name),
    tagline: d.tagline || "",
    castList: (d.credits?.cast || []).slice(0, 12).map((a) => ({
      name: a.name,
      role: a.character,
      image: a.profile_path ? `${IMG}/w185${a.profile_path}` : null,
    })),
  };
}

export default function Home() {
  const [tmdbData, setTmdbData] = useState({}); // { [movie.id]: data }
  const [selectedId, setSelectedId] = useState(null);
  const [selectedQuality, setSelectedQuality] = useState("");
  const [selectedActor, setSelectedActor] = useState(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auth (Google) + request page
  const { user, loading: authLoading, error: authError, setError: setAuthError, signIn, signOutUser } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Close the sign-in popup as soon as the user is signed in
  useEffect(() => {
    if (user) {
      setShowSignIn(false);
      setAuthError("");
      setAvatarFailed(false);
    }
  }, [user, setAuthError]);
  const [openMenu, setOpenMenu] = useState(null); // "series" | "language" | "genre" | null
  const toggleMenu = (name) => setOpenMenu((cur) => (cur === name ? null : name));

  // Close navbar dropdowns when tapping/clicking outside them, or on Esc
  useEffect(() => {
    const onPointerDown = (e) => {
      if (!e.target.closest?.("[data-menu]")) setOpenMenu(null);
    };
    const onKey = (e) => e.key === "Escape" && setOpenMenu(null);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  const [logoFailed, setLogoFailed] = useState(false);

  // Lock page scroll while the mobile drawer is open + close it with Esc
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    const onKey = (e) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  const [selectedLanguage, setSelectedLanguage] = useState("All");
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [selectedType, setSelectedType] = useState("all");

  const movieCarouselRef = useRef(null);
  const seriesCarouselRef = useRef(null);

  // ---------- Load everything from TMDB once ----------
  useEffect(() => {
    let cancelled = false;
    baseMovies.forEach((item) => {
      fetchTmdbData(item)
        .then((data) => {
          if (data && !cancelled) setTmdbData((prev) => ({ ...prev, [item.id]: data }));
        })
        .catch((err) => console.error(`TMDB error (${item.title}):`, err));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Merge static data + TMDB data ----------
  const movies = useMemo(
    () =>
      baseMovies.map((m) => {
        const t = tmdbData[m.id];
        if (!t) return { ...m, poster: m.image, backdrop: m.image, castList: m.castList || [] };
        return {
          ...m,
          tmdbId: t.tmdbId,
          poster: t.poster || m.image,
          backdrop: t.backdrop || t.poster || m.image,
          overview: t.overview,
          tagline: t.tagline,
          genres: t.genres,
          rating: t.rating || m.rating,
          castList: t.castList.length ? t.castList : m.castList || [],
        };
      }),
    [tmdbData]
  );

  const selectedMovie = useMemo(() => movies.find((m) => m.id === selectedId) || null, [movies, selectedId]);

  // ---------- URL sync (?movie=ID / ?actor=Name) ----------
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const movieId = params.get("movie");
      const actorParam = params.get("actor");

      if (params.get("page") === "request") {
        setShowRequest(true);
        setSelectedId(null);
        setSelectedActor(null);
        return;
      }
      setShowRequest(false);

      if (movieId) {
        const found = baseMovies.find((m) => String(m.id) === String(movieId));
        if (found) {
          setSelectedId(found.id);
          setSelectedActor(null);
          setSelectedQuality(found.videoLinks ? Object.keys(found.videoLinks)[0] : "");
          return;
        }
      }
      if (actorParam) {
        setSelectedActor(actorParam);
        setSelectedId(null);
      } else {
        setSelectedId(null);
        setSelectedActor(null);
      }
    };

    handleUrlChange();
    window.addEventListener("popstate", handleUrlChange);
    return () => window.removeEventListener("popstate", handleUrlChange);
  }, []);

  // ---------- Navbar scroll animation ----------
  useEffect(() => {
    const handleScroll = () => setScrollProgress(Math.min(window.scrollY / 150, 1));
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ---------- Auto-swipe carousels ----------
  useEffect(() => {
    const swipe = (ref) => {
      const el = ref.current;
      if (!el) return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      if (scrollLeft + clientWidth >= scrollWidth - 5) el.scrollTo({ left: 0, behavior: "smooth" });
      else el.scrollBy({ left: 240, behavior: "smooth" });
    };
    const timer = setInterval(() => {
      swipe(movieCarouselRef);
      swipe(seriesCarouselRef);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const languages = ["All", "English", "Tamil", "Hindi", "Kannada", "Korean"];
  const genres = ["All", "Action", "Sci-Fi", "Thriller", "Adventure", "Drama", "Crime", "Fantasy"];

  // ---------- Filtering ----------
  const filteredMovies = movies.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.language.toLowerCase().includes(q) ||
      item.genres?.some((g) => g.toLowerCase().includes(q)) ||
      item.castList?.some((a) => a.name.toLowerCase().includes(q)) ||
      item.cast?.toLowerCase().includes(q);

    const matchesLang = selectedLanguage === "All" || item.language.toLowerCase() === selectedLanguage.toLowerCase();
    const matchesGenre = selectedGenre === "All" || item.category.toLowerCase().includes(selectedGenre.toLowerCase());

    let matchesType = true;
    if (selectedType === "movie") matchesType = item.type === "movie";
    else if (selectedType === "series-all") matchesType = item.type === "series";
    else if (selectedType === "ongoing") matchesType = item.type === "series" && item.status === "ongoing";
    else if (selectedType === "completed") matchesType = item.type === "series" && item.status === "completed";

    return matchesSearch && matchesLang && matchesGenre && matchesType;
  });

  // ---------- Search mode + pagination ----------
  const isSearchActive = searchQuery.trim().length > 0;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredMovies.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedMovies = filteredMovies.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Go back to page 1 whenever the search / filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedType, selectedLanguage, selectedGenre]);

  const goToPage = (p) => {
    setPage(p);
    document.getElementById("collection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pageList = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    const out = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
      out.push(p);
    });
    return out;
  })();

  const showHero = selectedType === "all" && !isSearchActive;
  const showTrending = !isSearchActive && selectedType !== "all";

  // Top 10 lists are picked (and ordered) by the id arrays in moviesData.js
  const pickByIds = (ids) => ids.map((id) => movies.find((m) => m.id === id)).filter(Boolean).slice(0, 10);
  const trendingMovies = pickByIds(trendingMovieIds);
  const trendingSeries = pickByIds(trendingSeriesIds);

  // Hero banner rotates through the trending lists (movie #1, series #1, movie #2, series #2, ...)
  const heroList = [];
  for (let i = 0; i < 10; i++) {
    if (trendingMovies[i]) heroList.push({ item: trendingMovies[i], label: `Trending Movie #${i + 1}` });
    if (trendingSeries[i]) heroList.push({ item: trendingSeries[i], label: `Trending Series #${i + 1}` });
  }
  const heroSlides = heroList.slice(0, heroCount);

  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);

  useEffect(() => {
    if (heroSlides.length < 2 || heroPaused) return;
    const t = setInterval(() => setHeroIndex((i) => (i + 1) % heroSlides.length), 6000);
    return () => clearInterval(t);
  }, [heroSlides.length, heroPaused]);

  // ---------- Handlers ----------
  const openRequest = () => {
    setShowRequest(true);
    setSelectedId(null);
    setSelectedActor(null);
    setDrawerOpen(false);
    setOpenMenu(null);
    window.history.pushState({}, "", "/?page=request");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openSignIn = () => {
    setAuthError("");
    setDrawerOpen(false);
    setShowSignIn(true);
  };

  const handleSelectMovie = (item) => {
    setShowRequest(false);
    setSelectedId(item.id);
    setSelectedActor(null);
    setSelectedQuality(item.videoLinks ? Object.keys(item.videoLinks)[0] : "");
    window.history.pushState({}, "", `/?movie=${item.id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectActor = (actorName) => {
    setShowRequest(false);
    setSelectedActor(actorName);
    setSelectedId(null);
    window.history.pushState({}, "", `/?actor=${encodeURIComponent(actorName)}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goType = (type) => {
    setShowRequest(false);
    setSelectedId(null);
    setSelectedActor(null);
    setSelectedType(type);
    window.history.pushState({}, "", "/");
  };

  const handleBackToHome = () => {
    setShowRequest(false);
    setSelectedId(null);
    setSelectedActor(null);
    setSelectedType("all");
    setSelectedLanguage("All");
    setSelectedGenre("All");
    window.history.pushState({}, "", "/");
  };

  // ---------- Actor data ----------
  const actorMovies = selectedActor
    ? movies.filter(
        (m) =>
          m.castList?.some((a) => a.name.toLowerCase() === selectedActor.toLowerCase()) ||
          m.cast?.toLowerCase().includes(selectedActor.toLowerCase())
      )
    : [];

  const actorPhoto = selectedActor
    ? movies
        .flatMap((m) => m.castList || [])
        .find((a) => a?.name?.toLowerCase() === selectedActor.toLowerCase() && a.image)?.image
    : null;

  const currentLink = selectedMovie?.videoLinks ? selectedMovie.videoLinks[selectedQuality] : selectedMovie?.videoUrl;
  const isMegaEmbed = currentLink && currentLink.includes("mega.nz/embed");

  const isSeriesFilter = ["series-all", "ongoing", "completed"].includes(selectedType);
  const activeHero = heroSlides[heroIndex % Math.max(heroSlides.length, 1)];
  const heroItem = activeHero?.item;

  // ---------- Reusable card pieces ----------
  // Brand: real logo image, or emoji badge + text if the image isn't there
  const renderBrand = () =>
    logoFailed ? (
      <span className="text-xl sm:text-2xl font-black text-red-600 tracking-wider flex items-center gap-2">
        <span className="bg-red-600 text-white p-1.5 rounded-xl text-xs sm:text-sm shadow-md shadow-red-600/50 group-hover:rotate-12 transition-transform duration-300">
          🎬
        </span>
        CineLabz
      </span>
    ) : (
      <img
        src={LOGO_SRC}
        alt="CineLabz"
        className="h-8 sm:h-10 w-auto object-contain"
        onError={() => setLogoFailed(true)}
      />
    );

  const renderCard = (item) => (
    <div
      onClick={() => handleSelectMovie(item)}
      className="group relative bg-neutral-900 rounded-2xl overflow-hidden border border-white/5 cursor-pointer hover:-translate-y-2 transition-all duration-300 shadow-xl"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-neutral-800">
        <img
          src={item.poster || FALLBACK_POSTER}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={onImgError(FALLBACK_POSTER)}
        />
        <span className="absolute top-3 right-3 bg-black/60 text-red-500 text-xs px-3 py-1 rounded-full font-bold">
          {item.quality || "HD"}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span className="truncate pr-2">{item.genres?.slice(0, 2).join(" / ") || item.category}</span>
          <span className="text-yellow-400 font-bold flex-shrink-0">⭐ {item.rating}</span>
        </div>
        <h3 className="font-bold text-base text-white group-hover:text-red-500 truncate">{item.title}</h3>
      </div>
    </div>
  );

  const renderTrending = (list, refEl, label) => (
    <div className="pt-28 max-w-7xl mx-auto px-6 py-8">
      <p className="text-red-500 font-bold text-xs uppercase tracking-widest mb-1">Top Rated Highlights</p>
      <h2 className="text-2xl sm:text-3xl font-black mb-6">{label}</h2>
      <div
        ref={refEl}
        className="flex gap-5 overflow-x-auto pb-4 scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {list.map((item, index) => (
          <div
            key={item.id}
            onClick={() => handleSelectMovie(item)}
            className="min-w-[210px] sm:min-w-[230px] w-[230px] group relative bg-neutral-900 rounded-2xl overflow-hidden border border-white/10 cursor-pointer hover:scale-105 transition-all duration-300 flex-shrink-0 flex items-end"
          >
            <span
              className="absolute -left-1 -bottom-2 text-6xl font-black text-black z-20 group-hover:text-red-600 transition-colors pointer-events-none select-none"
              style={{ WebkitTextStroke: "2px rgba(255,255,255,0.7)" }}
            >
              {index + 1}
            </span>
            <div className="relative aspect-[2/3] w-full overflow-hidden ml-5 bg-neutral-800">
              <img
                src={item.poster || FALLBACK_POSTER}
                alt={item.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                onError={onImgError(FALLBACK_POSTER)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
              <span className="absolute top-2 right-2 bg-black/70 text-yellow-400 text-xs px-2 py-0.5 rounded font-bold">
                ⭐ {item.rating}
              </span>
              <div className="absolute bottom-2 left-2 right-2 z-30">
                <h4 className="font-bold text-xs text-white truncate">{item.title}</h4>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white selection:bg-red-600 selection:text-white font-sans overflow-x-hidden">
      {/* --- MORPHING NAVBAR --- */}
      <nav
        style={{
          width: isSearching ? "90%" : `${100 - scrollProgress * 10}%`,
          borderRadius: "9999px",
          top: isSearching ? "16px" : `${scrollProgress * 16}px`,
          paddingLeft: `${32 - scrollProgress * 8}px`,
          paddingRight: `${32 - scrollProgress * 8}px`,
          paddingTop: `${20 - scrollProgress * 6}px`,
          paddingBottom: `${20 - scrollProgress * 6}px`,
          backgroundColor: isSearching ? "rgba(10, 10, 10, 0.9)" : `rgba(10, 10, 10, ${scrollProgress * 0.85})`,
          backdropFilter: isSearching || scrollProgress > 0 ? "blur(20px)" : "none",
          borderWidth: isSearching || scrollProgress > 0 ? "1px" : "0px",
          borderColor: `rgba(255, 255, 255, ${scrollProgress * 0.12 || 0.1})`,
          boxShadow: isSearching || scrollProgress > 0.5 ? "0 10px 30px rgba(0, 0, 0, 0.6)" : "none",
          transition: isSearching ? "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)" : "none",
        }}
        className="fixed left-1/2 -translate-x-1/2 z-50 flex justify-between items-center"
      >
        {isSearching ? (
          <div className="flex items-center w-full gap-4 px-2">
            <span className="text-red-600 text-lg">🔍</span>
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (selectedId || selectedActor || showRequest) {
                  setShowRequest(false);
                  setSelectedId(null);
                  setSelectedActor(null);
                  window.history.pushState({}, "", "/");
                }
              }}
              placeholder="Search movies, series, cast..."
              className="w-full bg-transparent text-white placeholder-gray-400 text-sm sm:text-base focus:outline-none"
            />
            <button
              onClick={() => {
                setIsSearching(false);
                setSearchQuery("");
              }}
              className="bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white w-8 h-8 rounded-full flex items-center justify-center text-sm transition"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            {/* Desktop: logo → home */}
            <div onClick={handleBackToHome} className="hidden md:flex items-center cursor-pointer group">
              {renderBrand()}
            </div>

            {/* Mobile: ☰ (left of logo) opens the side drawer, logo → home */}
            <div className="md:hidden flex items-center gap-3">
              <button
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center cursor-pointer transition"
              >
                <svg className="w-5 h-5 stroke-white fill-none" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="14" y2="17" />
                </svg>
              </button>
              <div onClick={handleBackToHome} className="cursor-pointer group flex items-center">
                {renderBrand()}
              </div>
            </div>

            <div className="hidden md:flex items-center gap-6 text-sm font-semibold tracking-wide text-gray-300">
              <button
                onClick={handleBackToHome}
                className={`transition-colors duration-200 ${selectedType === "all" && !selectedActor ? "text-white font-bold" : "hover:text-white"}`}
              >
                Home
              </button>

              <button
                onClick={() => goType("movie")}
                className={`transition-colors duration-200 ${selectedType === "movie" ? "text-red-500 font-bold" : "hover:text-white"}`}
              >
                Movies
              </button>

              {/* TV Series Dropdown — hover (mouse) or tap/click (iPad / touch) */}
              <div
                data-menu
                className="relative group py-2"
                onMouseLeave={() => openMenu === "series" && setOpenMenu(null)}
              >
                <button
                  onClick={() => toggleMenu("series")}
                  aria-expanded={openMenu === "series"}
                  className={`transition-colors duration-200 flex items-center gap-1.5 cursor-pointer ${isSeriesFilter ? "text-red-500 font-bold" : "hover:text-white"}`}
                >
                  TV Series{" "}
                  {isSeriesFilter && (
                    <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded-full capitalize">
                      {selectedType.replace("-", " ")}
                    </span>
                  )}
                  <span className={`text-xs text-red-500 transition-transform duration-200 ${openMenu === "series" ? "rotate-180" : ""} [@media(hover:hover)]:group-hover:rotate-180`}>▾</span>
                </button>

                <div className={`absolute top-full left-0 ${openMenu === "series" ? "flex" : "hidden"} [@media(hover:hover)]:group-hover:flex flex-col bg-neutral-900/95 border border-white/10 backdrop-blur-xl rounded-2xl p-2 min-w-[160px] shadow-2xl z-50`}>
                  {[
                    ["series-all", "📺 All TV Series"],
                    ["ongoing", "🔥 Ongoing Series"],
                    ["completed", "✨ Completed Series"],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => {
                        goType(val);
                        setOpenMenu(null);
                      }}
                      className={`text-left px-3.5 py-2 text-xs rounded-xl transition-all cursor-pointer ${selectedType === val ? "bg-red-600 text-white font-bold" : "text-gray-300 hover:bg-white/10"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language Dropdown */}
              <div
                data-menu
                className="relative group py-2"
                onMouseLeave={() => openMenu === "language" && setOpenMenu(null)}
              >
                <button
                  onClick={() => toggleMenu("language")}
                  aria-expanded={openMenu === "language"}
                  className="hover:text-white transition-colors duration-200 flex items-center gap-1.5 cursor-pointer"
                >
                  Language{" "}
                  {selectedLanguage !== "All" && (
                    <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded-full">{selectedLanguage}</span>
                  )}
                  <span className={`text-xs text-red-500 transition-transform duration-200 ${openMenu === "language" ? "rotate-180" : ""} [@media(hover:hover)]:group-hover:rotate-180`}>▾</span>
                </button>
                <div className={`absolute top-full left-0 ${openMenu === "language" ? "flex" : "hidden"} [@media(hover:hover)]:group-hover:flex flex-col bg-neutral-900/95 border border-white/10 backdrop-blur-xl rounded-2xl p-2 min-w-[140px] shadow-2xl z-50`}>
                  {languages.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setSelectedLanguage(lang);
                        if (selectedId || selectedActor || showRequest) handleBackToHomeKeepFilters();
                        setOpenMenu(null);
                      }}
                      className={`text-left px-3 py-2 text-xs rounded-xl transition-all cursor-pointer ${selectedLanguage === lang ? "bg-red-600 text-white font-bold" : "text-gray-300 hover:bg-white/10"}`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genre Dropdown */}
              <div
                data-menu
                className="relative group py-2"
                onMouseLeave={() => openMenu === "genre" && setOpenMenu(null)}
              >
                <button
                  onClick={() => toggleMenu("genre")}
                  aria-expanded={openMenu === "genre"}
                  className="hover:text-white transition-colors duration-200 flex items-center gap-1.5 cursor-pointer"
                >
                  Genre{" "}
                  {selectedGenre !== "All" && (
                    <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded-full">{selectedGenre}</span>
                  )}
                  <span className={`text-xs text-red-500 transition-transform duration-200 ${openMenu === "genre" ? "rotate-180" : ""} [@media(hover:hover)]:group-hover:rotate-180`}>▾</span>
                </button>
                <div className={`absolute top-full left-0 ${openMenu === "genre" ? "flex" : "hidden"} [@media(hover:hover)]:group-hover:flex flex-col bg-neutral-900/95 border border-white/10 backdrop-blur-xl rounded-2xl p-2 min-w-[140px] shadow-2xl z-50`}>
                  {genres.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => {
                        setSelectedGenre(genre);
                        if (selectedId || selectedActor || showRequest) handleBackToHomeKeepFilters();
                        setOpenMenu(null);
                      }}
                      className={`text-left px-3 py-2 text-xs rounded-xl transition-all cursor-pointer ${selectedGenre === genre ? "bg-red-600 text-white font-bold" : "text-gray-300 hover:bg-white/10"}`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
              {/* Request (red) */}
              <button
                onClick={openRequest}
                className={`text-red-500 hover:text-red-400 font-bold transition-colors duration-200 cursor-pointer py-2 ${showRequest ? "underline underline-offset-8 decoration-2" : ""}`}
              >
                Request
              </button>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => setIsSearching(true)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all shadow-md"
                title="Search"
              >
                <svg className="w-5 h-5 stroke-white fill-none stroke-[2.5]" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="16.5" y1="16.5" x2="22" y2="22" strokeLinecap="round" />
                </svg>
              </button>
              {authLoading ? (
                <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
              ) : user ? (
                /* Signed in → Google profile picture + account menu */
                <div data-menu className="relative">
                  <button
                    onClick={() => toggleMenu("profile")}
                    aria-label="Account"
                    aria-expanded={openMenu === "profile"}
                    className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-red-600 hover:ring-red-400 transition cursor-pointer flex items-center justify-center bg-red-600 text-white font-bold"
                  >
                    {user.photoURL && !avatarFailed ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || "Profile"}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={() => setAvatarFailed(true)}
                      />
                    ) : (
                      (user.displayName || user.email || "U").charAt(0).toUpperCase()
                    )}
                  </button>

                  {openMenu === "profile" && (
                    <div className="absolute right-0 top-full mt-3 w-72 bg-neutral-900/95 border border-white/10 backdrop-blur-xl rounded-2xl p-4 shadow-2xl z-50 text-left">
                      <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                        <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-red-600 flex-shrink-0 flex items-center justify-center bg-red-600 font-bold">
                          {user.photoURL && !avatarFailed ? (
                            <img
                              src={user.photoURL}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            (user.displayName || user.email || "U").charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate">{user.displayName || "CineLabz user"}</p>
                          <p className="text-xs text-gray-400 truncate">{user.email}</p>
                        </div>
                      </div>

                      <button
                        onClick={openRequest}
                        className="w-full text-left mt-3 px-3 py-2.5 rounded-xl text-sm text-gray-300 hover:bg-white/10 transition cursor-pointer"
                      >
                        🎯 My requests
                      </button>
                      <button
                        onClick={async () => {
                          setOpenMenu(null);
                          await signOutUser();
                        }}
                        className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm font-bold bg-red-600/15 text-red-400 hover:bg-red-600 hover:text-white transition cursor-pointer text-center"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={openSignIn}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm px-5 py-2 rounded-full font-bold shadow-lg cursor-pointer"
                >
                  Sign In
                </button>
              )}
            </div>
          </>
        )}
      </nav>

      {/* --- MOBILE SIDE DRAWER --- */}
      <div
        onClick={() => setDrawerOpen(false)}
        className={`fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm transition-opacity duration-300 md:hidden ${drawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />
      <aside
        className={`fixed top-0 left-0 z-[70] h-full w-[80%] max-w-xs bg-neutral-950 border-r border-white/10 shadow-2xl flex flex-col transition-transform duration-300 ease-out md:hidden ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <div
            onClick={() => {
              handleBackToHome();
              setDrawerOpen(false);
            }}
            className="cursor-pointer group"
          >
            {renderBrand()}
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          <div className="space-y-1.5">
            {[
              ["all", "🏠 Home", () => handleBackToHome()],
              ["movie", "🎬 Movies", () => goType("movie")],
            ].map(([val, label, action]) => (
              <button
                key={val}
                onClick={() => {
                  action();
                  setDrawerOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition cursor-pointer ${
                  selectedType === val && !selectedActor && !selectedId
                    ? "bg-red-600 text-white"
                    : "text-gray-300 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}

            <button
              onClick={openRequest}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-red-500 transition cursor-pointer ${showRequest ? "bg-red-600/15" : "hover:bg-white/10"}`}
            >
              🎯 Request
            </button>

            <p className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-widest text-gray-500 font-bold">TV Series</p>
            {[
              ["series-all", "📺 All TV Series"],
              ["ongoing", "🔥 Ongoing Series"],
              ["completed", "✨ Completed Series"],
            ].map(([val, label]) => (
              <button
                key={val}
                onClick={() => {
                  goType(val);
                  setDrawerOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition cursor-pointer ${
                  selectedType === val && !selectedActor && !selectedId
                    ? "bg-red-600 text-white"
                    : "text-gray-300 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <p className="px-1 pb-2 text-[11px] uppercase tracking-widest text-gray-500 font-bold">Language</p>
            <div className="flex flex-wrap gap-2">
              {languages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    setSelectedLanguage(lang);
                    if (selectedId || selectedActor || showRequest) handleBackToHomeKeepFilters();
                    setDrawerOpen(false);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                    selectedLanguage === lang ? "bg-red-600 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="px-1 pb-2 text-[11px] uppercase tracking-widest text-gray-500 font-bold">Genre</p>
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => {
                    setSelectedGenre(genre);
                    if (selectedId || selectedActor || showRequest) handleBackToHomeKeepFilters();
                    setDrawerOpen(false);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                    selectedGenre === genre ? "bg-red-600 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20"
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between">
          <span className="text-[11px] text-gray-500">© 2026 CineLabz</span>
          <div className="flex gap-2">
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-300 hover:text-white"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </aside>

      {/* --- 1. ACTOR PAGE --- */}
      {showRequest ? (
        /* --- 0. REQUEST PAGE (sign-in required) --- */
        <RequestPage user={user} authLoading={authLoading} onSignIn={openSignIn} onBack={handleBackToHome} />
      ) : selectedActor ? (
        <div className="pt-28 sm:pt-36 max-w-7xl mx-auto px-6 pb-16 space-y-8">
          <button
            onClick={handleBackToHome}
            className="bg-white/10 hover:bg-white/20 border border-white/10 px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 cursor-pointer transition"
          >
            ← Back to Home
          </button>

          <div className="bg-neutral-900/80 border border-white/10 p-6 sm:p-10 rounded-3xl backdrop-blur-xl flex flex-col sm:flex-row items-center gap-6 sm:gap-8 shadow-2xl">
            <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-red-600 shadow-xl flex-shrink-0">
              <img
                src={actorPhoto || FALLBACK_ACTOR}
                alt={selectedActor}
                className="w-full h-full object-cover"
                onError={onImgError(FALLBACK_ACTOR)}
              />
            </div>
            <div className="text-center sm:text-left space-y-2">
              <span className="bg-red-600/20 text-red-500 border border-red-600/30 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                Actor / Cast Member
              </span>
              <h1 className="text-3xl sm:text-5xl font-black">{selectedActor}</h1>
              <p className="text-gray-400 text-sm">
                Starring in {actorMovies.length} movie{actorMovies.length === 1 ? "" : "s"} & TV series on CineLabz
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              🎬 Movies & TV Series starring <span className="text-red-500">{selectedActor}</span>
            </h2>
            {actorMovies.length === 0 ? (
              <div className="text-center py-16 text-gray-400 bg-neutral-900/40 rounded-2xl border border-white/5">
                <p>No other movies found for this cast member.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                {actorMovies.map((item) => (
                  <div key={item.id}>{renderCard(item)}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : selectedMovie ? (
        /* --- 2. WATCH PAGE --- */
        <div className="pt-28 sm:pt-36 max-w-6xl mx-auto px-4 sm:px-6 pb-16 space-y-8">
          <div className="flex justify-between items-center">
            <button
              onClick={handleBackToHome}
              className="bg-white/10 hover:bg-white/20 border border-white/10 px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 cursor-pointer transition"
            >
              ← Back to Home
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert("Movie link copied to clipboard!");
              }}
              className="bg-red-600 hover:bg-red-700 px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-red-600/30 cursor-pointer"
            >
              🔗 Share Movie Link
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-wide">{selectedMovie.title}</h1>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                  {selectedMovie.genres?.length ? selectedMovie.genres.join(" / ") : selectedMovie.category} •{" "}
                  {selectedMovie.language} • ⭐ {selectedMovie.rating}
                </p>
                {selectedMovie.tagline && (
                  <p className="text-xs text-red-400 italic mt-1">{selectedMovie.tagline}</p>
                )}
              </div>

              {selectedMovie.videoLinks && (
                <div className="flex items-center gap-2 bg-neutral-900 border border-white/10 px-4 py-2 rounded-xl shadow-lg">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Quality:</span>
                  <select
                    value={selectedQuality}
                    onChange={(e) => setSelectedQuality(e.target.value)}
                    className="bg-transparent text-red-500 font-bold text-sm focus:outline-none cursor-pointer"
                  >
                    {Object.keys(selectedMovie.videoLinks).map((q) => (
                      <option key={q} value={q} className="bg-neutral-900 text-white">
                        {q} HD
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="relative aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-white/5">
              {isMegaEmbed ? (
                <iframe src={currentLink} className="w-full h-full border-0" allowFullScreen loading="lazy"></iframe>
              ) : (
                <video
                  key={currentLink}
                  controls
                  crossOrigin="anonymous"
                  className="w-full h-full object-contain"
                  poster={selectedMovie.backdrop || selectedMovie.poster || FALLBACK_POSTER}
                >
                  <source src={currentLink} type="video/mp4" />
                  {selectedMovie.subtitleUrl && (
                    <track kind="subtitles" src={selectedMovie.subtitleUrl} srcLang="si" label="Sinhala" default />
                  )}
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          </div>

          {/* DETAILS + CAST */}
          <div className="bg-neutral-900/60 border border-white/10 p-6 sm:p-8 rounded-3xl backdrop-blur-md space-y-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <img
                src={selectedMovie.poster || FALLBACK_POSTER}
                alt={selectedMovie.title}
                className="w-40 sm:w-48 rounded-2xl shadow-xl self-center sm:self-start flex-shrink-0 border border-white/10"
                onError={onImgError(FALLBACK_POSTER)}
              />
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-red-500 uppercase tracking-widest mb-2">
                    About Movie / සිංහල විස්තරය
                  </h3>
                  {selectedMovie.sinhalaDescription && (
                    <p className="text-gray-200 text-sm sm:text-base leading-relaxed mb-3">
                      {selectedMovie.sinhalaDescription}
                    </p>
                  )}
                  {selectedMovie.overview ? (
                    <p className="text-gray-400 text-sm sm:text-base leading-relaxed">{selectedMovie.overview}</p>
                  ) : (
                    !selectedMovie.sinhalaDescription && (
                      <p className="text-gray-500 text-sm">Loading description…</p>
                    )
                  )}
                </div>
                {selectedMovie.director && (
                  <p className="text-sm text-gray-400">
                    <span className="text-gray-200 font-semibold">Director:</span> {selectedMovie.director}
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-bold text-gray-200 uppercase tracking-wider">Top Cast / ප්‍රධාන නළුවන්</h3>
                <span className="text-xs text-gray-400">Click a cast member to view their movies</span>
              </div>

              {selectedMovie.castList && selectedMovie.castList.length > 0 ? (
                <div
                  className="flex gap-4 overflow-x-auto pb-4 scroll-smooth"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {selectedMovie.castList.map((actor, idx) => (
                    <div
                      key={`${actor.name}-${idx}`}
                      onClick={() => handleSelectActor(actor.name)}
                      className="min-w-[150px] w-[160px] bg-white/5 border border-white/10 p-3 rounded-2xl hover:bg-white/10 hover:border-red-600/50 hover:scale-105 transition-all duration-300 group cursor-pointer flex-shrink-0 flex flex-col items-center text-center"
                    >
                      <div className="relative w-20 h-20 mb-3 rounded-full overflow-hidden ring-2 ring-red-600/40 group-hover:ring-red-600 transition">
                        <img
                          src={actor.image || FALLBACK_ACTOR}
                          alt={actor.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                          onError={onImgError(FALLBACK_ACTOR)}
                        />
                      </div>
                      <h4 className="font-bold text-xs text-white group-hover:text-red-500 transition line-clamp-1">
                        {actor.name}
                      </h4>
                      <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{actor.role}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">
                  {tmdbData[selectedMovie.id] ? selectedMovie.cast || "Cast information not available." : "Loading cast…"}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* --- 3. HOME --- */
        <div>
          {showHero && heroItem && (
            <div
              className="relative h-screen w-full flex items-end p-8 sm:p-16 overflow-hidden"
              onMouseEnter={() => setHeroPaused(true)}
              onMouseLeave={() => setHeroPaused(false)}
            >
              <div className="absolute inset-0 bg-neutral-900">
                {heroSlides.map((s, i) => (
                  <img
                    key={s.item.id}
                    src={s.item.backdrop || FALLBACK_POSTER}
                    alt={s.item.title}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === heroIndex ? "opacity-100" : "opacity-0"}`}
                    onError={onImgError(FALLBACK_POSTER)}
                  />
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-black/30"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent"></div>
              </div>

              <div key={heroItem.id} className="relative z-10 max-w-2xl space-y-5 pb-10 animate-[fadeIn_0.8s_ease]">
                <div className="flex items-center gap-3">
                  <span className="bg-red-600 text-white text-xs px-3 py-1 rounded-full font-black uppercase">
                    {activeHero.label}
                  </span>
                  <span className="text-yellow-400 font-bold text-sm">⭐ {heroItem.rating}</span>
                </div>
                <h1 className="text-4xl sm:text-6xl font-black text-white">{heroItem.title}</h1>
                <p className="text-gray-300 text-sm sm:text-base line-clamp-3">
                  {heroItem.overview || heroItem.sinhalaDescription}
                </p>
                <div className="flex items-center gap-4 pt-3">
                  <button
                    onClick={() => handleSelectMovie(heroItem)}
                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-3.5 rounded-2xl font-bold flex items-center gap-3 shadow-xl cursor-pointer"
                  >
                    ▶ Watch Now
                  </button>
                </div>

                {heroSlides.length > 1 && (
                  <div className="flex items-center gap-2 pt-4">
                    {heroSlides.map((s, i) => (
                      <button
                        key={s.item.id}
                        onClick={() => setHeroIndex(i)}
                        aria-label={`Show ${s.item.title}`}
                        className={`h-1.5 rounded-full transition-all duration-500 ${i === heroIndex ? "w-8 bg-red-600" : "w-3 bg-white/30 hover:bg-white/60"}`}
                      />
                    ))}
                  </div>
                )}
              </div>
              <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }`}</style>
            </div>
          )}

          {showTrending && selectedType === "movie" &&
            renderTrending(trendingMovies, movieCarouselRef, "Trending Movies Top 10")}
          {showTrending && isSeriesFilter &&
            renderTrending(trendingSeries, seriesCarouselRef, "Trending TV Series Top 10")}

          <div
            id="collection"
            className={`max-w-7xl w-full mx-auto px-6 py-8 scroll-mt-28 ${showHero ? "pt-12" : showTrending ? "" : "pt-28"}`}
          >
            <div className="flex justify-between items-center mb-8 gap-3 flex-wrap">
              <h2 className="text-2xl sm:text-3xl font-black capitalize">
                {isSearchActive ? (
                  <>
                    Results for “<span className="text-red-500">{searchQuery.trim()}</span>”
                    <span className="text-sm font-semibold text-gray-400 ml-3">
                      {filteredMovies.length} found
                    </span>
                  </>
                ) : selectedType === "all" ? (
                  "All Movies & TV Series"
                ) : selectedType === "series-all" ? (
                  "All TV Series Collection"
                ) : (
                  `${selectedType} Collection`
                )}
              </h2>
              {(selectedLanguage !== "All" || selectedGenre !== "All" || selectedType !== "all") && (
                <button
                  onClick={() => {
                    setSelectedLanguage("All");
                    setSelectedGenre("All");
                    setSelectedType("all");
                  }}
                  className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full text-gray-300 cursor-pointer"
                >
                  Reset Filters ✕
                </button>
              )}
            </div>

            {filteredMovies.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-lg">No movies or series found! 🔍</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                {pagedMovies.map((item) => (
                  <div key={item.id}>{renderCard(item)}</div>
                ))}
              </div>
            )}

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12 flex-wrap">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  ← Prev
                </button>
                {pageList.map((p, i) =>
                  p === "…" ? (
                    <span key={`dots-${i}`} className="px-2 text-gray-500">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p)}
                      className={`w-10 h-10 rounded-xl text-sm font-bold transition cursor-pointer ${
                        p === currentPage
                          ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                          : "bg-white/10 hover:bg-white/20 text-gray-300"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- GOOGLE SIGN-IN POPUP --- */}
      <SignInModal
        open={showSignIn && !user}
        onClose={() => setShowSignIn(false)}
        onGoogle={signIn}
        error={authError}
        reason={showRequest ? "Sign in with your Google account to request movies & TV series." : undefined}
      />

      {/* --- FOOTER --- */}
      <footer className="mt-auto border-t border-white/10 bg-black/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs sm:text-sm text-gray-400 text-center sm:text-left">
            © 2026 <span className="text-red-500 font-bold">CineLabz</span>. All rights reserved
            <span className="mx-2 text-gray-600">|</span>
            Developed by <span className="text-white font-semibold">Cloud + Shakya</span>
          </p>

          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                title={s.name}
                className={`w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-gray-300 transition-all duration-300 hover:-translate-y-1 hover:scale-110 hover:text-white hover:border-transparent hover:shadow-lg ${s.hover}`}
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );

  // Close detail/actor pages but keep the language/genre filter the user just picked
  function handleBackToHomeKeepFilters() {
    setShowRequest(false);
    setSelectedId(null);
    setSelectedActor(null);
    window.history.pushState({}, "", "/");
  }
}