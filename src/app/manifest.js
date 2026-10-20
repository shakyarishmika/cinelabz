// src/app/manifest.js  : lets the site be installed as an app (iPhone: opens full screen, no address bar)
export default function manifest() {
  return {
    name: "CineLabz",
    short_name: "CineLabz",
    description: "Movies & TV series with subtitles",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [{ src: "/apple-icon", sizes: "180x180", type: "image/png" }],
  };
}