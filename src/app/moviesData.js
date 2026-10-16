// src/app/moviesData.js
//
// TMDB එකෙන් poster / backdrop / cast / overview / rating auto load වෙනවා.
// - tmdbId දීලා තියෙනවනම් කෙලින්ම ඒක පාවිච්චි වෙනවා.
// - tmdbId නැත්නම් tmdbQuery (නැත්නම් title) + year වලින් TMDB search කරලා හොයාගන්නවා.
// - `image` එක TMDB poster එක නැති වුණොත් විතරක් පාවිච්චි වෙන fallback එකක්.

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&auto=format&fit=crop&q=80";
const TEST_VIDEO = "https://www.w3schools.com/html/mov_bbb.mp4";
const TEST_SUBS = "https://gist.githubusercontent.com/netroy/126938b/raw/subtitles.vtt";

export const movies = [
  // --- MOVIES ---
  {
    id: 1,
    type: "movie",
    tmdbQuery: "Leo",
    year: 2023,
    title: "Leo (2023) Sinhala Subtitle",
    quality: "HD 1080p",
    category: "Action / Thriller",
    language: "Tamil",
    rating: "8.8/10",
    image: FALLBACK_IMG,
    videoUrl: TEST_VIDEO,
    subtitleUrl: TEST_SUBS,
    sinhalaDescription: "ලංකාවේ අංක එකේ සිංහල උපසිරැසි සමඟ නරඹන්න. උසස් තත්වයෙන් HD අත්දැකීමක්.",
  },
  {
    id: 2,
    type: "movie",
    tmdbId: 157336,
    title: "Interstellar (2014) Sinhala Sub",
    quality: "IMAX 4K",
    category: "Sci-Fi / Adventure",
    language: "English",
    rating: "9.3/10",
    image: FALLBACK_IMG,
    videoUrl: TEST_VIDEO,
    subtitleUrl: TEST_SUBS,
    sinhalaDescription: "අන්තර්කාශයේ අපූරු ගමන් මඟක් සිංහල උපසිරැසි සමඟින්.",
  },
  {
    id: 3,
    type: "movie",
    tmdbQuery: "Jawan",
    year: 2023,
    title: "Jawan (2023) Sinhala Subtitle",
    quality: "HD 1080p",
    category: "Action / Drama",
    language: "Hindi",
    rating: "8.1/10",
    image: FALLBACK_IMG,
    videoUrl: TEST_VIDEO,
    subtitleUrl: TEST_SUBS,
    sinhalaDescription: "ෂාරුක් ඛාන්ගේ සුපිරි ක්‍රියාදාම සිනමාපටය සිංහල උපසිරැසි සමඟින්.",
  },
  {
    id: 4,
    type: "movie",
    tmdbId: 27205,
    title: "Inception (2010) Sinhala Sub",
    quality: "4K UHD",
    category: "Sci-Fi / Thriller",
    language: "English",
    rating: "8.8/10",
    image: FALLBACK_IMG,
    videoUrl: TEST_VIDEO,
    subtitleUrl: TEST_SUBS,
    sinhalaDescription: "සිහින ඇතුළත සිහින මවන ක්‍රියාදාම අත්දැකීමක් සිංහල උපසිරැසි සමඟින්.",
  },
  {
    id: 5,
    type: "movie",
    tmdbId: 76600,
    title: "Avatar: The Way of Water (2022)",
    quality: "IMAX 3D",
    category: "Sci-Fi / Fantasy",
    language: "English",
    rating: "7.6/10",
    image: FALLBACK_IMG,
    videoUrl: TEST_VIDEO,
    subtitleUrl: TEST_SUBS,
    sinhalaDescription: "පැන්ඩෝරා ලෝකයේ සාගර සටන සිංහල උපසිරැසි සමඟින් නරඹන්න.",
  },
  {
    id: 6,
    type: "movie",
    tmdbQuery: "K.G.F: Chapter 2",
    year: 2022,
    title: "KGF Chapter 2 (2022) Sinhala Sub",
    quality: "HD 1080p",
    category: "Action / Crime",
    language: "Kannada",
    rating: "8.4/10",
    image: FALLBACK_IMG,
    videoUrl: TEST_VIDEO,
    subtitleUrl: TEST_SUBS,
    sinhalaDescription: "රොකී බායිගේ අධිරාජ්‍යය නැවතත් රිදී තිරයට.",
  },

  // --- TV SERIES (Ongoing & Completed) ---
  {
    id: 7,
    type: "series",
    status: "ongoing",
    tmdbId: 93405,
    title: "Squid Game Season 2 (Sinhala Sub)",
    quality: "HD 1080p",
    category: "Thriller / Drama",
    language: "Korean",
    rating: "8.9/10",
    image: FALLBACK_IMG,
    videoUrl: TEST_VIDEO,
    subtitleUrl: TEST_SUBS,
    sinhalaDescription: "ළඟ එන මාරාන්තික ක්‍රීඩා මාලාව සිංහල උපසිරැසි සමඟින්.",
  },
  {
    id: 8,
    type: "series",
    status: "ongoing",
    tmdbId: 94997,
    title: "House of the Dragon S2 (Sinhala Sub)",
    quality: "IMAX 4K",
    category: "Fantasy / Drama",
    language: "English",
    rating: "8.6/10",
    image: FALLBACK_IMG,
    videoUrl: TEST_VIDEO,
    subtitleUrl: TEST_SUBS,
    sinhalaDescription: "ඩ්‍රැගන් යුද්ධයේ දෙවන අදියර සිංහල උපසිරැසි සමඟින්.",
  },
  {
    id: 9,
    type: "series",
    status: "completed",
    tmdbId: 1396,
    title: "Breaking Bad (Complete Series)",
    quality: "HD 1080p",
    category: "Crime / Drama",
    language: "English",
    rating: "9.5/10",
    image: FALLBACK_IMG,
    videoUrl: TEST_VIDEO,
    subtitleUrl: TEST_SUBS,
    sinhalaDescription: "ලොව මෙතෙක් බිහි වූ විශිෂ්ටතම අපරාධ කතා මාලාව සම්පූර්ණයෙන්.",
  },
  {
    id: 10,
    type: "series",
    status: "completed",
    tmdbId: 2288,
    title: "Prison Break (Complete Series)",
    quality: "HD 1080p",
    category: "Action / Thriller",
    language: "English",
    rating: "8.3/10",
    image: FALLBACK_IMG,
    videoUrl: TEST_VIDEO,
    subtitleUrl: TEST_SUBS,
    sinhalaDescription: "බන්ධනාගාරයෙන් පලා යාමේ කතා මාලාව.",
  },
  {
    id: 11,
    type: "movie",
    tmdbQuery: "Spider-Man: Brand New Day",
    year: 2026,
    title: "Spider-Man: Brand New Day (2026)",
    quality: "WEB-DL 1080p",
    category: "Action / Sci-Fi",
    language: "English",
    rating: "9.1/10",
    image: FALLBACK_IMG,
    sinhalaDescription:
      "ස්පයිඩර්-මෑන් නවතම චිත්‍රපටය. මෙහි පීටර් පාකර් නව අභියෝග රැසකට මුහුණ දෙයි. CineLabz හරහා උසස්ම තත්වයෙන් නරඹන්න.",
    cast: "Tom Holland, Zendaya, Jacob Batalon",
    director: "Destin Daniel Cretton",
    videoLinks: {
      "1080p": "https://mega.nz/embed/E78zmCCI#LAM7FSZPk9Ej5I46FryoTj4LTqkQDUt4x9lt15F2poo",
      "720p": "https://mega.nz/embed/1ncyzZhb#-GjFGwHzDj-CFoyYBYH-ijhv1N8eyAuVazKFzWgyAZI",
      "480p": "https://mega.nz/embed/Iic0EKQZ#eGwzsAbZwzlhNc27D7JZqtXKk-ZnVrPctax8jMewq3I",
    },
    subtitleUrl: TEST_SUBS,
  },
];

// ======================================================================
// TRENDING TOP 10 — මෙතන movie `id` ලියලා ඔයාට ඕන ඒවා තෝරන්න.
// ලියන පිළිවෙලම #1, #2, #3... විදියට පෙන්නනවා (උපරිම 10).
// ======================================================================
export const trendingMovieIds = [11, 2, 4, 1, 3, 5, 6];
export const trendingSeriesIds = [8, 7, 9, 10];

// Home hero banner එකේ auto-rotate වෙන slides ගණන
// (movie #1, series #1, movie #2, series #2 ... කියලා trending lists දෙකෙන් අරන්)
export const heroCount = 6;