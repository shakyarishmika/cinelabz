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
import React from 'react';

export default function Server3({ url, poster, title, subtitles }) {
  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl flex items-center justify-center">
      {url ? (
        <iframe
          src={url}
          title={title || "Movie Embed Player - Server 3"}
          className="absolute top-0 left-0 w-full h-full border-0"
          scrolling="no"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-gray-400 p-4">
          {poster && (
            <img 
              src={poster} 
              alt={title} 
              className="w-24 h-36 object-cover rounded shadow-md mb-3 opacity-60" 
            />
          )}
          <p className="text-sm font-medium">Server 3 (Backup Embed) is not configured.</p>
        </div>
      )}
    </div>
  );
}