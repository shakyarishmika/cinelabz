import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'CineLabz - Watch Movies & Series with Sinhala Subtitles',
  description: 'High Quality Movies and Series with Sinhala Subtitles',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}// src/app/moviesData.js

export const movies = [
    // --- MOVIES ---
    {
        id: 1,
        type: "movie",
        title: "Leo (2023) Sinhala Subtitle",
        quality: "HD 1080p",
        category: "Action / Thriller",
        language: "Tamil",
        rating: "8.8/10",
        image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&auto=format&fit=crop&q=80",
        videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        subtitleUrl: "https://gist.githubusercontent.com/netroy/126938b/raw/subtitles.vtt",
        description: "ලංකාවේ අංක එකේ සිංහල උපසිරැසි සමඟ නරඹන්න. උසස් තත්වයෙන් HD අත්දැකීමක්."
    },
    {
        id: 2,
        type: "movie",
        title: "Interstellar (2014) Sinhala Sub",
        quality: "IMAX 4K",
        category: "Sci-Fi / Adventure",
        language: "English",
        rating: "9.3/10",
        image: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1200&auto=format&fit=crop&q=80",
        videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        subtitleUrl: "https://gist.githubusercontent.com/netroy/126938b/raw/subtitles.vtt",
        description: "අන්තර්කාශයේ අපූරු ගමන් මඟක් සිංහල උපසිරැසි සමඟින්."
    },
    {
        id: 3,
        type: "movie",
        title: "Jawan (2023) Sinhala Subtitle",
        quality: "HD 1080p",
        category: "Action / Drama",
        language: "Hindi",
        rating: "8.1/10",
        image: "https://images.unsplash.com/photo-1616530940355-351fabd9524b?w=1200&auto=format&fit=crop&q=80",
        videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        subtitleUrl: "https://gist.githubusercontent.com/netroy/126938b/raw/subtitles.vtt",
        description: "ෂාරුක් ඛාන්ගේ සුපිරි ක්‍රියාදාම සිනමාපටය සිංහල උපසිරැසි සමඟින්."
    },
    {
        id: 4,
        type: "movie",
        title: "Inception (2010) Sinhala Sub",
        quality: "4K UHD",
        category: "Sci-Fi / Thriller",
        language: "English",
        rating: "8.8/10",
        image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80",
        videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        subtitleUrl: "https://gist.githubusercontent.com/netroy/126938b/raw/subtitles.vtt",
        description: "සිහින ඇතුළත සිහින මවන ක්‍රියාදාම අත්දැකීමක් සිංහල උපසිරැසි සමඟින්."
    },
    {
        id: 5,
        type: "movie",
        title: "Avatar: The Way of Water (2022)",
        quality: "IMAX 3D",
        category: "Sci-Fi / Fantasy",
        language: "English",
        rating: "7.6/10",
        image: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&auto=format&fit=crop&q=80",
        videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        subtitleUrl: "https://gist.githubusercontent.com/netroy/126938b/raw/subtitles.vtt",
        description: "පැන්ඩෝරා ලෝකයේ සාගර සටන සිංහල උපසිරැසි සමඟින් නරඹන්න."
    },
    {
        id: 6,
        type: "movie",
        title: "KGF Chapter 2 (2022) Sinhala Sub",
        quality: "HD 1080p",
        category: "Action / Crime",
        language: "Kannada",
        rating: "8.4/10",
        image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&auto=format&fit=crop&q=80",
        videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        subtitleUrl: "https://gist.githubusercontent.com/netroy/126938b/raw/subtitles.vtt",
        description: "රොකී බායිගේ අධිරාජ්‍යය නැවතත් රිදී තිරයට."
    },

    // --- TV SERIES (Ongoing & Completed) ---
    {
        id: 7,
        type: "series",
        status: "ongoing", // Ongoing series
        title: "Squid Game Season 2 (Sinhala Sub)",
        quality: "HD 1080p",
        category: "Thriller / Drama",
        language: "Korean",
        rating: "8.9/10",
        image: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=1200&auto=format&fit=crop&q=80",
        videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        subtitleUrl: "https://gist.githubusercontent.com/netroy/126938b/raw/subtitles.vtt",
        description: "새로운 ළඟ එන මාරාන්තික ක්‍රීඩා මාලාව සිංහල උපසිරැසි සමඟින්."
    },
    {
        id: 8,
        type: "series",
        status: "ongoing",
        title: "House of the Dragon S2 (Sinhala Sub)",
        quality: "IMAX 4K",
        category: "Fantasy / Drama",
        language: "English",
        rating: "8.6/10",
        image: "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=1200&auto=format&fit=crop&q=80",
        videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        subtitleUrl: "https://gist.githubusercontent.com/netroy/126938b/raw/subtitles.vtt",
        description: "ඩ්‍රැගන් යුද්ධයේ දෙවන අදියර සිංහල උපසිරැසි සමඟින්."
    },
    {
        id: 9,
        type: "series",
        status: "completed", // Completed series
        title: "Breaking Bad (Complete Series)",
        quality: "HD 1080p",
        category: "Crime / Drama",
        language: "English",
        rating: "9.5/10",
        image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80",
        videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        subtitleUrl: "https://gist.githubusercontent.com/netroy/126938b/raw/subtitles.vtt",
        description: "ලොව මෙතෙක් බිහි වූ විශිෂ්ටතම අපරාධ කතා මාලාව සම්පූර්ණයෙන්."
    },
    {
        id: 10,
        type: "series",
        status: "completed",
        title: "Prison Break (Complete Series)",
        quality: "HD 1080p",
        category: "Action / Thriller",
        language: "English",
        rating: "8.3/10",
        image: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=80",
        videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        subtitleUrl: "https://gist.githubusercontent.com/netroy/126938b/raw/subtitles.vtt",
        description: "බන්ධනාගාරයෙන් පලා යාමේ রোমাන්චක කතා මාලාව සිංහල උපසිරැසි සමඟින්."
    },
    {
        id: 11,
        type: "movie",
        title: "Spider-Man: Brand New Day (2026)",
        quality: "WEB-DL 1080p",
        category: "Action / Sci-Fi",
        language: "English",
        rating: "9.1/10",
        image: "https://images.unsplash.com/photo-1635805737707-575885ab0820?w=1200&auto=format&fit=crop&q=80",

        // 🔗 Magnet Link එක කෙලින්ම දාන්න:
        videoLinks: {
            "1080p": "https://mega.nz/embed/E78zmCCI#LAM7FSZPk9Ej5I46FryoTj4LTqkQDUt4x9lt15F2poo",
            "720p": "https://mega.nz/embed/1ncyzZhb#-GjFGwHzDj-CFoyYBYH-ijhv1N8eyAuVazKFzWgyAZI",
            "480p": "https://mega.nz/embed/Iic0EKQZ#eGwzsAbZwzlhNc27D7JZqtXKk-ZnVrPctax8jMewq3I",
        },

        subtitleUrl: "https://gist.githubusercontent.com/netroy/126938b/raw/subtitles.vtt",
        description: "Spider-Man නවතම චිත්‍රපටය උසස්ම තත්වයෙන් නරඹන්න."
    }
];

