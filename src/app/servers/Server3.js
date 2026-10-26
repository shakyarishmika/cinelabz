"use client";

// ===========================================================================
//  SERVER 3  >>>  PUT YOUR OWN CUSTOM PLAYER CODE IN THIS FILE  <<<
//
//  This component is shown when the visitor taps "Server 3" under the player.
//  Props you get:
//     url        the link you typed for "Server 3" in the admin panel
//     poster     the film's poster image
//     title      the film / episode title
//     subtitles  [{ label, url }]  the subtitle link from the admin panel
//  Return any React element (keep the 16:9 shape, e.g. "relative aspect-video").
//  Until you replace it, it simply opens the link inside a frame.
// ===========================================================================
import React, { useState, useEffect, useRef } from 'react';

export default function Server3({ url, poster, title, subtitles }) {
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [activeSubUrl, setActiveSubUrl] = useState('');
  const subtitleCuesRef = useRef([]);

  // 1. Subtitles දෙනවද බලලා පළමු .vtt file එක load කරගැනීම
  useEffect(() => {
    if (subtitles && subtitles.length > 0) {
      // පළමු subtitle link එක (හෝ active subtitle එක) තෝරාගැනීම
      const validSub = subtitles.find(sub => sub.url && sub.url.endsWith('.vtt')) || subtitles[0];
      if (validSub && validSub.url) {
        setActiveSubUrl(validSub.url);
      }
    }
  }, [subtitles]);

  // 2. .vtt file එක parse කරලා cues (time & text) array එකකට ගැනීම
  useEffect(() => {
    if (!activeSubUrl) return;

    fetch(activeSubUrl)
      .then(res => res.text())
      .then(data => {
        const parsedCues = parseVTT(data);
        subtitleCuesRef.current = parsedCues;
      })
      .catch(err => console.error("Error loading subtitle:", err));
  }, [activeSubUrl]);

  // 3. Simple VTT Parser Function
  const parseVTT = (vttText) => {
    const lines = vttText.split(/\r?\n/);
    const cues = [];
    let currentCue = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('-->')) {
        const parts = line.split('-->');
        currentCue = {
          start: parseTime(parts[0].trim()),
          end: parseTime(parts[1].trim()),
          text: ''
        };
        let textLines = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i].trim());
          i++;
        }
        currentCue.text = textLines.join('<br/>');
        cues.push(currentCue);
      }
    }
    return cues;
  };

  // VTT time format (00:00.000) to seconds converter
  const parseTime = (timeStr) => {
    const parts = timeStr.split(':');
    if (parts.length === 3) {
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return 0;
  };

  // Note: Iframe එක cross-origin නිසා video player එකේ exact time එක track කරන්න බැරි අවස්ථාවලදී, 
  // මෙහි පහත UI එක හරහා user ට subtitle track එක enable/disable කරගන්න පුළුවන් option එකක් දිය හැක.
  
  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl flex items-center justify-center group">
      
      {/* Watermark Logo (public/logo.png) - Top Right */}
      <div className="absolute top-4 right-4 z-30 pointer-events-none opacity-80 hover:opacity-100 transition-opacity">
        <img 
          src="/logo.png" 
          alt="Site Logo" 
          className="h-8 md:h-10 w-auto object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
        />
      </div>

      {/* Subtitle Indicator / Selector Badge */}
      {subtitles && subtitles.length > 0 && (
        <div className="absolute bottom-4 right-4 z-30 bg-black/70 text-white text-xs px-2.5 py-1 rounded backdrop-blur-sm border border-white/10">
          CC: {subtitles[0].label || "Active Subtitle"}
        </div>
      )}

      {/* Video Embed Iframe */}
      {url ? (
        <iframe
          src={url}
          title={title || "Movie Player - Server 3"}
          className="absolute top-0 left-0 w-full h-full border-0"
          scrolling="no"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-gray-400 p-4">
          {poster && (
            <img 
              src={poster} 
              alt={title} 
              className="w-24 h-36 object-cover rounded mb-2 opacity-50" 
            />
          )}
          <p className="text-sm">Server 3 link is not available.</p>
        </div>
      )}
    </div>
  );
}