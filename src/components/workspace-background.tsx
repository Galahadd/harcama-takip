"use client";

import { useEffect, useRef } from "react";

// MotionSites AI Runtime: keep the original hosted asset, not a landing-page embed.
const videoUrl = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4";

export function WorkspaceBackground({ paused }: { paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      let storedPause = false;
      try { storedPause = localStorage.getItem("finance-motion") === "paused"; } catch { /* Storage is optional. */ }
      if (paused || storedPause || preference.matches || document.hidden) {
        video.pause();
      } else {
        void video.play().catch(() => { /* The static backdrop remains if autoplay is blocked. */ });
      }
    };
    sync();
    preference.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      preference.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      video.pause();
    };
  }, [paused]);

  return (
    <div className="workspace-background" aria-hidden="true">
      <video ref={videoRef} className="workspace-background-video" muted loop playsInline
        preload="metadata" disablePictureInPicture tabIndex={-1}>
        <source src={videoUrl} type="video/mp4" />
      </video>
      <div className="workspace-background-scrim" />
    </div>
  );
}
