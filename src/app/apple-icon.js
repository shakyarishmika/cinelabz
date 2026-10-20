// src/app/apple-icon.js
// iPhone "Add to Home Screen" icon: your logo on a solid BLACK square (180x180).
// Uses public/app-icon.png if it exists (best: a square 512x512 logo), otherwise public/logo.png.
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

async function loadLogo() {
  for (const name of ["app-icon.png", "logo.png"]) {
    try {
      const buf = await readFile(path.join(process.cwd(), "public", name));
      return `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      /* try the next file */
    }
  }
  return null;
}

export default async function AppleIcon() {
  const logo = await loadLogo();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#000000" }}>
        {logo ? (
          <img src={logo} width={136} height={136} style={{ objectFit: "contain" }} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 120, height: 120, borderRadius: 28, background: "#dc2626", color: "#ffffff", fontSize: 84, fontWeight: 900 }}>
            C
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}