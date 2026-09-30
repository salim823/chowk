"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { uploadAvatarFile, removeAvatar } from "@/lib/avatar";

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

/** Camera capture modal: live preview + Capture button. */
export function CameraModal({
  onClose,
  onCaptured,
}: {
  onClose: () => void;
  onCaptured: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (
          !navigator.mediaDevices ||
          typeof navigator.mediaDevices.getUserMedia !== "function"
        ) {
          throw new Error("no-camera");
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) {
          setError(
            "Could not access your camera. Please allow camera access and try again."
          );
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCaptured(
            new File([blob], `camera_${Date.now()}.jpg`, {
              type: "image/jpeg",
            })
          );
        }
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-label="Take a photo"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-bold text-[#211D33]">Take a photo</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera"
            className="cursor-pointer rounded-full p-2 text-[#6F6B80] transition-colors hover:bg-[#F5F4FA]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="bg-black">
          {error ? (
            <p className="p-8 text-center text-[15px] font-medium text-white">
              {error}
            </p>
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-[4/3] w-full object-cover"
            />
          )}
        </div>
        <div className="p-4">
          <button
            type="button"
            onClick={capture}
            disabled={starting || !!error}
            className="w-full cursor-pointer rounded-lg bg-[#4F46E5] py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {starting ? "Starting camera..." : "Capture"}
          </button>
        </div>
      </div>
    </div>
  );
}

type AvatarMenuProps = {
  /** True for the viewer's own avatar: shows Take / Upload / Remove. */
  isOwn: boolean;
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  /** Called after avatar_url changes (own avatar only). */
  onChanged: (url: string | null) => void;
  children: ReactNode;
};

/**
 * Clickable avatar. Own avatar → Chowk-style menu (Take a photo, Upload photo,
 * Remove photo). Another user's avatar → photo lightbox (view only).
 */
export function AvatarMenu({
  isOwn,
  profileId,
  displayName,
  avatarUrl,
  onChanged,
  children,
}: AvatarMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const clickable = isOwn || !!avatarUrl;

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setConfirmRemove(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  async function handleFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusy(true);
    setMenuError(null);
    try {
      const url = await uploadAvatarFile(supabase, profileId, file);
      onChanged(url);
      setMenuOpen(false);
      setConfirmRemove(false);
    } catch {
      setMenuError("Could not update your photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusy(true);
    setMenuError(null);
    try {
      await removeAvatar(supabase, profileId);
      onChanged(null);
      setMenuOpen(false);
      setConfirmRemove(false);
    } catch {
      setMenuError("Could not remove your photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function openMenu() {
    if (!isOwn) {
      if (avatarUrl) setLightbox(true);
      return;
    }
    setMenuError(null);
    setConfirmRemove(false);
    setMenuOpen((v) => !v);
  }

  return (
    <>
      <div className="relative">
        {clickable ? (
          <button
            type="button"
            onClick={openMenu}
            aria-label={
              isOwn ? "Change your profile photo" : `View ${displayName}'s photo`
            }
            aria-haspopup={isOwn ? "menu" : undefined}
            className="block cursor-pointer rounded-full transition-opacity hover:opacity-90"
          >
            {children}
          </button>
        ) : (
          children
        )}

        {isOwn && menuOpen && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => {
                setMenuOpen(false);
                setConfirmRemove(false);
              }}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div
              role="menu"
              aria-label="Profile photo options"
              className="absolute left-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/10"
            >
              {confirmRemove ? (
                <div className="p-3">
                  <p className="px-1 py-1 text-[15px] font-semibold text-[#211D33]">
                    Remove your profile photo?
                  </p>
                  {menuError && (
                    <p className="px-1 py-1 text-sm font-medium text-red-600">
                      {menuError}
                    </p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(false)}
                      disabled={busy}
                      className="flex-1 cursor-pointer rounded-lg bg-[#E6E3F0] py-2 text-sm font-semibold text-[#211D33] transition-colors hover:bg-neutral-300 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemove()}
                      disabled={busy}
                      className="flex-1 cursor-pointer rounded-lg bg-red-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      {busy ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() => {
                      setMenuOpen(false);
                      setCameraOpen(true);
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-[15px] font-medium text-[#211D33] transition-colors hover:bg-[#F5F4FA] disabled:opacity-50"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F4FA] text-[#211D33]">
                      <CameraIcon />
                    </span>
                    Take a photo
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-[15px] font-medium text-[#211D33] transition-colors hover:bg-[#F5F4FA] disabled:opacity-50"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F4FA] text-[#211D33]">
                      <ImageIcon />
                    </span>
                    {busy ? "Uploading..." : "Upload photo"}
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={busy}
                      onClick={() => setConfirmRemove(true)}
                      className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-[15px] font-medium text-red-600 transition-colors hover:bg-[#F5F4FA] disabled:opacity-50"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F4FA]">
                        <TrashIcon />
                      </span>
                      Remove photo
                    </button>
                  )}
                  {menuError && (
                    <p className="px-4 py-2 text-sm font-medium text-red-600">
                      {menuError}
                    </p>
                  )}
                </>
              )}
            </div>
          </>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {cameraOpen && (
        <CameraModal
          onClose={() => setCameraOpen(false)}
          onCaptured={(file) => {
            setCameraOpen(false);
            void handleFile(file);
          }}
        />
      )}

      {lightbox && avatarUrl && (
        <div
          className="fixed inset-0 z-[70] flex cursor-pointer items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-label={`${displayName}'s profile photo`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt={`${displayName}'s profile photo`}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
}
