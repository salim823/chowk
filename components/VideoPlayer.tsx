"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

/**
 * Only one feed video plays at a time, like Chowk. The player that most
 * recently started (via scroll or tap) claims this slot; the previous one
 * is paused.
 */
let activeVideo: HTMLVideoElement | null = null;

function claimSlot(video: HTMLVideoElement) {
  if (activeVideo && activeVideo !== video) {
    try {
      activeVideo.pause();
    } catch {
      /* noop */
    }
  }
  activeVideo = video;
}

function releaseSlot(video: HTMLVideoElement) {
  if (activeVideo === video) activeVideo = null;
}

function PlayIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="#fff" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4V5z" fill="#fff" stroke="none" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function UnmutedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4V5z" fill="#fff" stroke="none" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9.4 9.4 0 0 1 0 13" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

/**
 * Chowk-style inline video player: autoplays muted when scrolled into
 * view, pauses when scrolled out. Tap toggles play/pause. Overlays: mute
 * toggle, fullscreen, and a subtle progress bar at the bottom.
 */
export function VideoPlayer({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);

  // Autoplay muted when ~50% visible; pause when scrolled out of view.
  useEffect(() => {
    const video = videoRef.current;
    const wrap = wrapRef.current;
    if (!video || !wrap) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            claimSlot(video);
            video.muted = true;
            setMuted(true);
            video
              .play()
              .then(() => setPlaying(true))
              .catch(() => setPlaying(false));
          } else {
            video.pause();
            releaseSlot(video);
            setPlaying(false);
          }
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(wrap);
    return () => {
      obs.disconnect();
      releaseSlot(video);
    };
  }, [url]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      claimSlot(video);
      // Autoplay policies require muted playback; if the user unmuted and
      // the browser blocks it, fall back to muted.
      video
        .play()
        .then(() => setPlaying(true))
        .catch(() => {
          video.muted = true;
          setMuted(true);
          video
            .play()
            .then(() => setPlaying(true))
            .catch(() => setPlaying(false));
        });
    } else {
      video.pause();
      releaseSlot(video);
      setPlaying(false);
    }
  }

  function toggleMute(e: ReactMouseEvent) {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function goFullscreen(e: ReactMouseEvent) {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (video.requestFullscreen) {
      // Claim the slot so feed autoplay doesn't fight fullscreen.
      claimSlot(video);
      video.requestFullscreen().catch(() => {});
    }
  }

  function onTimeUpdate() {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress(video.currentTime / video.duration);
  }

  return (
    <div ref={wrapRef} className="group relative h-full w-full bg-black">
      <video
        ref={videoRef}
        src={url}
        className="h-full w-full cursor-pointer object-cover"
        preload="metadata"
        playsInline
        muted
        loop
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={onTimeUpdate}
        onEnded={() => setPlaying(false)}
      />

      {/* Center play badge when paused */}
      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play video"
          className="absolute inset-0 flex cursor-pointer items-center justify-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 transition-transform hover:scale-105">
            <PlayIcon />
          </span>
        </button>
      )}

      {/* Bottom controls: progress bar + mute + fullscreen.
          Always visible on touch; hover-reveal on desktop. */}
      <div className="absolute inset-x-0 bottom-0 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
        <div className="flex items-center justify-end gap-1 px-2 pb-1.5">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute video" : "Mute video"}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 transition-colors hover:bg-black/80"
          >
            {muted ? <MutedIcon /> : <UnmutedIcon />}
          </button>
          <button
            type="button"
            onClick={goFullscreen}
            aria-label="Watch fullscreen"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 transition-colors hover:bg-black/80"
          >
            <FullscreenIcon />
          </button>
        </div>
        <div
          className="h-1 w-full bg-white/25"
          role="progressbar"
          aria-label="Video progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full bg-[#4F46E5] transition-[width]"
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
