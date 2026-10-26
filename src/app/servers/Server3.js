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
import EmbedFrame from "./EmbedFrame";

export default function Server3({ url, title }) {
  return <EmbedFrame url={url} title={title} />;
}
