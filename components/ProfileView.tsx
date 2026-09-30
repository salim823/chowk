"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { FollowCountsLine } from "@/components/FollowButton";
import { AvatarMenu, CameraModal } from "@/components/AvatarMenu";
import { ChowkModal, ChowkModalButton } from "@/components/ChowkModal";
import { isVideoUrl } from "@/lib/media";
import type { PostRow, ProfileFull, ProfileLite } from "@/lib/types";

export type FriendLite = ProfileLite & { id: string };

export type ProfileTab = "posts" | "about" | "friends" | "photos";

type Tab = ProfileTab;

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function PinDropIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2H2v10l9.3 9.3a2 2 0 0 0 2.8 0l7.2-7.2a2 2 0 0 0 0-2.8Z" />
      <circle cx="7" cy="7" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function PhotoActionIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="#45BD62" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </svg>
  );
}

function VideoActionIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="#EC4899" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 8-6 4 6 4V8Z" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  );
}

function GhostActionIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="#8B5CF6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 10h.01M15 10h.01M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />
    </svg>
  );
}

/**
 * Chowk composer card: avatar + "What's happening on campus?" pill, then a
 * Photo / Video / Anonymous action row. Opens the shared post composer.
 */
export function ComposerCard({
  avatar,
  firstName,
  onOpen,
  onOpenWithPhotos,
  onOpenAnonymous,
}: {
  avatar: ReactNode;
  firstName: string;
  onOpen: () => void;
  onOpenWithPhotos: () => void;
  onOpenAnonymous?: () => void;
}) {
  const actions = [
    { label: "Photo", Icon: PhotoActionIcon, onClick: onOpenWithPhotos },
    { label: "Video", Icon: VideoActionIcon, onClick: onOpenWithPhotos },
    ...(onOpenAnonymous
      ? [{ label: "Anonymous", Icon: GhostActionIcon, onClick: onOpenAnonymous }]
      : []),
  ];
  return (
    <div className="chowk-card chowk-rise p-3">
      <div className="flex w-full items-center gap-3">
        {avatar}
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 cursor-pointer rounded-full bg-[#F5F4FA] px-4 py-2.5 text-left text-[15px] text-[#6F6B80] ring-1 ring-[#E6E3F0] transition-all hover:bg-[#EEF2FF] hover:ring-[#C7D2FE] active:scale-[0.99]"
        >
          What&apos;s happening on campus{firstName ? `, ${firstName}` : ""}?
        </button>
      </div>
      <div className="my-2.5 border-t border-[#E6E3F0]" />
      <div className="flex">
        {actions.map(({ label, Icon, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl py-2 text-sm font-bold text-[#6F6B80] transition-colors hover:bg-[#F5F4FA] hover:text-[#211D33] active:scale-95"
          >
            <Icon />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 3-column media grid with lightbox, shared by Grid view and the Photos tab.
 * Video tiles show a first-frame thumbnail with a play badge; the lightbox
 * plays videos with native controls. */
function PhotoGrid({
  photos,
  onView,
}: {
  photos: string[];
  onView: (url: string) => void;
}) {
  if (photos.length === 0) {
    return (
      <p className="py-6 text-center text-[15px] text-[#6F6B80]">
        No photos yet.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-1">
      {photos.map((url) => {
        const video = isVideoUrl(url);
        return (
          <button
            key={url}
            type="button"
            onClick={() => onView(url)}
            className="relative aspect-square cursor-pointer overflow-hidden rounded-lg transition-opacity hover:opacity-90"
            aria-label={video ? "Play video" : "View photo"}
          >
            {video ? (
              <>
                <video
                  src={url}
                  preload="metadata"
                  muted
                  playsInline
                  className="h-full w-full bg-black object-cover"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </span>
              </>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={url}
                alt="Post photo"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

type ProfileViewProps = {
  profile: ProfileFull;
  isOwn: boolean;
  /** Buttons under the name: Edit profile / Create post / Add friend / Follow... */
  headerActions: ReactNode;
  /** Composer pill card above the posts (own profile only). */
  composerCard?: ReactNode;
  /** The posts list (FeedList) shown in List view. */
  postsList: ReactNode;
  /** False when the viewer may not see posts (private account / blocked). */
  postsAccessible?: boolean;
  /** Shown in grid view when posts are not accessible. */
  lockedNotice?: ReactNode;
  /** Friends tab content (parent composes from its own data). */
  friendsSection: ReactNode;
  /** Extra rows in the About tab: edit form / privacy / logout / block / report. */
  aboutExtra?: ReactNode;
  /** The composer modal element (own profile only). */
  composerModal?: ReactNode;
  /** Posts of this user (used for the Photos tab grid). */
  posts: PostRow[];
  friendCount: number;
  /** Called when the tab changes (lets parents lazy-load). */
  onTabChange?: (tab: Tab) => void;
  /** Called when the viewer's own avatar changes (own profile only). */
  onAvatarChanged?: (url: string | null) => void;
  /** Tab selected on first render (e.g. deep-linked via ?tab=about). */
  initialTab?: ProfileTab;
};

/**
 * Chowk-style profile: cover banner, overlapping avatar, name + counts,
 * action buttons, and Posts | About | Friends | Photos tabs.
 * Shared by the own profile and public profile pages.
 */
export function ProfileView({
  profile,
  isOwn,
  headerActions,
  composerCard,
  postsList,
  postsAccessible = true,
  lockedNotice,
  friendsSection,
  aboutExtra,
  composerModal,
  posts,
  friendCount,
  onTabChange,
  onAvatarChanged,
  initialTab,
}: ProfileViewProps) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "posts");
  const [postView, setPostView] = useState<"list" | "grid">("list");
  const [coverUrl, setCoverUrl] = useState<string | null>(
    profile.cover_url ?? null
  );
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverMenuOpen, setCoverMenuOpen] = useState(false);
  const [coverCameraOpen, setCoverCameraOpen] = useState(false);
  const [coverConfirmRemove, setCoverConfirmRemove] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const displayName = profile.full_name || profile.username;
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  const photos = posts.flatMap((p) => p.image_urls ?? []);

  function switchTab(t: Tab) {
    setTab(t);
    onTabChange?.(t);
  }

  async function handleCoverFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setCoverBusy(true);
    setCoverError(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `covers/${profile.id}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(path, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("post-images").getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ cover_url: data.publicUrl })
        .eq("id", profile.id);
      if (updateError) throw updateError;
      setCoverUrl(data.publicUrl);
    } catch {
      setCoverError("Could not update your cover photo. Please try again.");
    } finally {
      setCoverBusy(false);
    }
  }

  async function handleRemoveCover() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setCoverBusy(true);
    setCoverError(null);
    try {
      // Best-effort: delete stored cover files, then clear the URL.
      const { data: files } = await supabase.storage
        .from("post-images")
        .list(`covers/${profile.id}`);
      const paths = (files ?? [])
        .filter((f) => f.id)
        .map((f) => `covers/${profile.id}/${f.name}`);
      if (paths.length > 0) {
        await supabase.storage.from("post-images").remove(paths);
      }
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ cover_url: null })
        .eq("id", profile.id);
      if (updateError) throw updateError;
      setCoverUrl(null);
      setCoverMenuOpen(false);
      setCoverConfirmRemove(false);
    } catch {
      setCoverError("Could not remove your cover photo. Please try again.");
    } finally {
      setCoverBusy(false);
    }
  }

  function openCoverMenu() {
    setCoverError(null);
    setCoverConfirmRemove(false);
    setCoverMenuOpen(true);
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "posts", label: "Posts" },
    { id: "about", label: "About" },
    { id: "friends", label: "Friends" },
    { id: "photos", label: "Photos" },
  ];

  return (
    <div className="w-full">
      {/* Cover */}
      <div className="relative h-44 overflow-hidden rounded-b-xl bg-white sm:h-64 md:h-[400px]">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt="Cover photo"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#4F46E5] via-[#8B5CF6] to-[#EC4899]">
            {/* Subtle dotted texture so the default cover feels designed. */}
            <div
              aria-hidden
              className="h-full w-full opacity-20"
              style={{
                backgroundImage: "radial-gradient(white 1.2px, transparent 1.2px)",
                backgroundSize: "22px 22px",
              }}
            />
          </div>
        )}
        {isOwn && (
          <>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void handleCoverFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={openCoverMenu}
              disabled={coverBusy}
              className="absolute bottom-3 right-3 flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#211D33] shadow transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CameraIcon />
              {coverBusy ? "Uploading..." : "Edit cover photo"}
            </button>
          </>
        )}
      </div>
      {coverError && (
        <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {coverError}
        </p>
      )}

      {/* Cover photo options — same choices as the profile photo menu. */}
      <ChowkModal
        open={coverMenuOpen}
        onClose={() => {
          if (!coverBusy) {
            setCoverMenuOpen(false);
            setCoverConfirmRemove(false);
          }
        }}
        title="Cover photo"
        subtitle={
          coverConfirmRemove
            ? "Remove your cover photo?"
            : "Change your cover photo"
        }
        size="sm"
        footer={
          coverConfirmRemove ? (
            <>
              <ChowkModalButton
                tone="neutral"
                disabled={coverBusy}
                onClick={() => setCoverConfirmRemove(false)}
              >
                Cancel
              </ChowkModalButton>
              <ChowkModalButton
                tone="dark"
                disabled={coverBusy}
                onClick={() => void handleRemoveCover()}
              >
                {coverBusy ? "Removing..." : "Remove"}
              </ChowkModalButton>
            </>
          ) : undefined
        }
      >
        {coverConfirmRemove ? (
          <p className="text-[15px] leading-6 text-[#6F6B80]">
            Your profile will show the default cover instead. You can upload a
            new one any time.
          </p>
        ) : (
          <div className="-mx-5 -my-4">
            <button
              type="button"
              disabled={coverBusy}
              onClick={() => {
                setCoverMenuOpen(false);
                setCoverCameraOpen(true);
              }}
              className="flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left text-[15px] font-medium text-[#211D33] transition-colors hover:bg-[#F5F4FA] disabled:opacity-50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F4FA] text-[#211D33]">
                <CameraIcon />
              </span>
              Take a photo
            </button>
            <button
              type="button"
              disabled={coverBusy}
              onClick={() => {
                setCoverMenuOpen(false);
                coverInputRef.current?.click();
              }}
              className="flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left text-[15px] font-medium text-[#211D33] transition-colors hover:bg-[#F5F4FA] disabled:opacity-50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F4FA] text-[#211D33]">
                <ImageIcon />
              </span>
              {coverBusy ? "Uploading..." : "Upload photo"}
            </button>
            {coverUrl && (
              <button
                type="button"
                disabled={coverBusy}
                onClick={() => setCoverConfirmRemove(true)}
                className="flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left text-[15px] font-medium text-[#211D33] transition-colors hover:bg-[#F5F4FA] disabled:opacity-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F4FA] text-[#211D33]">
                  <TrashIcon />
                </span>
                Remove photo
              </button>
            )}
          </div>
        )}
      </ChowkModal>

      {coverCameraOpen && (
        <CameraModal
          onClose={() => setCoverCameraOpen(false)}
          onCaptured={(file) => {
            setCoverCameraOpen(false);
            void handleCoverFile(file);
          }}
        />
      )}

      {/* Header: avatar + name + actions.
          Desktop: avatar overlaps the cover's bottom-left; name/bio/stats sit
          immediately to its right, vertically centered with it. Mobile stacks
          naturally (avatar, then name below). */}
      <div className="bg-white/80 px-4 pb-3 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
            <div className="relative -mt-12 shrink-0 sm:-mt-14 md:-mt-20">
              <AvatarMenu
                isOwn={isOwn}
                profileId={profile.id}
                displayName={displayName}
                avatarUrl={profile.avatar_url ?? null}
                onChanged={onAvatarChanged ?? (() => {})}
              >
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={`${displayName}'s profile photo`}
                    className="h-28 w-28 rounded-full object-cover ring-4 ring-white md:h-40 md:w-40"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#4F46E5] text-4xl font-bold text-white ring-4 ring-white md:h-40 md:w-40 md:text-6xl">
                    {initial}
                  </div>
                )}
              </AvatarMenu>
            </div>
            <div className="min-w-0 pb-1">
              <h1 className="truncate text-2xl font-bold text-[#211D33] md:text-[32px] md:leading-10">
                {displayName}
              </h1>
              {profile.bio ? (
                <p className="mt-1 line-clamp-2 max-w-md text-[15px] text-[#211D33]">
                  {profile.bio}
                </p>
              ) : null}
              <p className="mt-1 text-[15px] text-[#6F6B80]">
                {friendCount} friend{friendCount === 1 ? "" : "s"}
              </p>
              <FollowCountsLine userId={profile.id} />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 pb-1">
            {headerActions}
          </div>
        </div>

        {/* Tabs */}
        <nav
          aria-label="Profile sections"
          className="mt-3 flex gap-1 border-t border-[#E6E3F0] pt-2"
        >
          {TABS.map(({ id, label }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => switchTab(id)}
                aria-current={active ? "page" : undefined}
                className={`cursor-pointer rounded-full px-4 py-2 text-[15px] transition-all active:scale-95 ${
                  active
                    ? "bg-[#4F46E5] font-bold text-white shadow-md shadow-[#4F46E5]/25"
                    : "font-semibold text-[#6F6B80] hover:bg-[#EEF2FF] hover:text-[#4338CA]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-4 px-2 pb-6 sm:px-0">
        {tab === "posts" && (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <section
              aria-label="Personal details"
              className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200 lg:w-[360px] lg:shrink-0"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#211D33]">
                  Personal details
                </h2>
                {isOwn && (
                  <button
                    type="button"
                    onClick={() => switchTab("about")}
                    aria-label="Edit details"
                    title="Edit details"
                    className="cursor-pointer rounded-full p-2 text-[#6F6B80] transition-colors hover:bg-[#F5F4FA]"
                  >
                    <PencilIcon />
                  </button>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-4 text-[15px]">
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-[#6F6B80]">
                    <PersonIcon />
                  </span>
                  <FollowCountsLine userId={profile.id} />
                </div>
                {profile.bio ? (
                  <p className="flex items-start gap-3 text-[#211D33]">
                    <span className="shrink-0 text-[#6F6B80]">
                      <TagIcon />
                    </span>
                    <span>{profile.bio}</span>
                  </p>
                ) : null}
                {!profile.bio && isOwn ? (
                  <p className="text-[#6F6B80]">
                    Add your details from Edit profile.
                  </p>
                ) : null}
              </div>
            </section>
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              {composerCard}
              <div className="rounded-xl bg-white shadow-sm ring-1 ring-neutral-200">
                <div className="px-4 pt-3">
                  <h2 className="text-xl font-bold text-[#211D33]">Posts</h2>
                </div>
                <div
                  className="mt-1 flex gap-2 border-t border-neutral-200 px-4"
                  role="tablist"
                  aria-label="Posts view"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={postView === "list"}
                    onClick={() => setPostView("list")}
                    className={`-mb-px flex flex-1 cursor-pointer items-center justify-center gap-2 border-b-[3px] py-2.5 text-[15px] transition-colors ${
                      postView === "list"
                        ? "border-[#4F46E5] font-semibold text-[#4F46E5]"
                        : "border-transparent font-medium text-[#6F6B80] hover:bg-[#F5F4FA]"
                    }`}
                  >
                    <ListIcon />
                    List view
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={postView === "grid"}
                    onClick={() => setPostView("grid")}
                    className={`-mb-px flex flex-1 cursor-pointer items-center justify-center gap-2 border-b-[3px] py-2.5 text-[15px] transition-colors ${
                      postView === "grid"
                        ? "border-[#4F46E5] font-semibold text-[#4F46E5]"
                        : "border-transparent font-medium text-[#6F6B80] hover:bg-[#F5F4FA]"
                    }`}
                  >
                    <GridIcon />
                    Grid view
                  </button>
                </div>
              </div>
              {postView === "list" ? (
                postsList
              ) : (
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
                  {postsAccessible ? (
                    <PhotoGrid photos={photos} onView={setLightbox} />
                  ) : (
                    lockedNotice
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "about" && (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            <section
              aria-label="About"
              className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200"
            >
              <h2 className="text-xl font-bold text-[#211D33]">About</h2>
              <dl className="mt-3 flex flex-col gap-3 text-[15px]">
                <div className="flex gap-3">
                  <dt className="w-28 shrink-0 font-semibold text-[#6F6B80]">
                    Name
                  </dt>
                  <dd className="text-[#211D33]">{displayName}</dd>
                </div>
                {isOwn && (
                  <div className="flex gap-3">
                    <dt className="w-28 shrink-0 font-semibold text-[#6F6B80]">
                      Username
                    </dt>
                    <dd className="text-[#211D33]">@{profile.username}</dd>
                  </div>
                )}
                <div className="flex gap-3">
                  <dt className="w-28 shrink-0 font-semibold text-[#6F6B80]">
                    Bio
                  </dt>
                  <dd className="text-[#211D33]">
                    {profile.bio || "Not added yet"}
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-28 shrink-0 font-semibold text-[#6F6B80]">
                    Follows
                  </dt>
                  <dd>
                    <FollowCountsLine userId={profile.id} />
                  </dd>
                </div>
              </dl>
            </section>
            {aboutExtra}
          </div>
        )}

        {tab === "friends" && friendsSection}

        {tab === "photos" && (
          <section
            aria-label="Photos"
            className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200"
          >
            <h2 className="text-xl font-bold text-[#211D33]">Photos</h2>
            <div className="mt-3">
              <PhotoGrid photos={photos} onView={setLightbox} />
            </div>
          </section>
        )}
      </div>

      {composerModal}

      {lightbox && (
        <div
          className="fixed inset-0 z-[70] flex cursor-pointer items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-label="Media viewer"
        >
          {isVideoUrl(lightbox) ? (
            <video
              src={lightbox}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={lightbox}
              alt="Photo full screen"
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Small friend row used by the Friends tabs. */
export function FriendRow({
  id,
  username,
  full_name,
}: {
  id: string;
  username: string;
  full_name: string | null;
}) {
  const name = full_name || username;
  return (
    <li className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4F46E5] text-base font-bold text-white">
        {name.trim().charAt(0).toUpperCase() || "?"}
      </div>
      <Link
        href={`/profile/${encodeURIComponent(username)}`}
        className="min-w-0 flex-1 cursor-pointer truncate text-[15px] font-semibold text-[#211D33] transition-colors hover:underline"
      >
        {name}
      </Link>
    </li>
  );
}
