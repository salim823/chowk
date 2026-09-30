"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Avatar } from "@/components/Avatar";
import { FeedList } from "@/components/FeedList";
import { PostComposerModal } from "@/components/PostComposerModal";
import { ProfileView, FriendRow, ComposerCard, type ProfileTab } from "@/components/ProfileView";
import { TextField, SubmitButton } from "@/components/auth-ui";
import LogoutButton from "@/components/LogoutButton";
import { getMyFriendData } from "@/lib/friends";
import { selectWithFallback, isMissingColumnError } from "@/lib/safeSelect";
import { AvatarMenu } from "@/components/AvatarMenu";
import { FeedbackModal } from "@/components/FeedbackModal";
import type { PostRow, ProfileFull, ProfileLite } from "@/lib/types";

/** The viewer's own profile, Chowk style. */
export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileFull | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [friendCount, setFriendCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const [friends, setFriends] = useState<(ProfileLite & { id: string })[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [photoNonce, setPhotoNonce] = useState(0);
  const [deactOpen, setDeactOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const orderPosts = useCallback(
    (list: PostRow[], pinnedId: string | null | undefined) => {
      if (!pinnedId) {
        return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
      }
      const pinned = list.filter((p) => p.id === pinnedId);
      const rest = list
        .filter((p) => p.id !== pinnedId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return [...pinned, ...rest];
    },
    []
  );

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    // Resilient: works whether or not cover.sql / pin.sql / bio.sql were run.
    const { data } = await selectWithFallback(
      () =>
        supabase
          .from("profiles")
          .select(
            "id, username, full_name, avatar_url, gali, is_private, is_admin, cover_url, pinned_post_id, bio, username_changed_at"
          )
          .eq("id", user.id)
          .maybeSingle(),
      () =>
        supabase
          .from("profiles")
          .select(
            "id, username, full_name, avatar_url, gali, is_private, is_admin"
          )
          .eq("id", user.id)
          .maybeSingle()
    );
    const prof = (data as ProfileFull | null) ?? null;
    setProfile(prof);
    if (prof) {
      setEditName(prof.full_name ?? "");
      setEditBio(prof.bio ?? "");
      setEditUsername(prof.username ?? "");
    }

    const { data: postRows } = await supabase
      .from("posts")
      .select("*, profiles!posts_user_id_fkey(username, full_name, avatar_url)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setPosts(orderPosts((postRows ?? []) as PostRow[], prof?.pinned_post_id));

    try {
      const fd = await getMyFriendData(supabase, user.id);
      setFriendCount(fd.acceptedIds.size);
      setRequestCount(fd.receivedRequests.length);
      if (fd.acceptedIds.size > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", [...fd.acceptedIds]);
        setFriends((profs ?? []) as (ProfileLite & { id: string })[]);
      }
    } catch {
      // Best-effort; counts stay zero.
    }
    setLoading(false);
  }, [orderPosts]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePrivacyToggle() {
    if (!profile || toggling) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setToggling(true);
    try {
      const next = !profile.is_private;
      const { error } = await supabase
        .from("profiles")
        .update({ is_private: next })
        .eq("id", profile.id);
      if (error) throw error;
      setProfile({ ...profile, is_private: next });
    } catch {
      // Best-effort; the toggle stays as it was.
    } finally {
      setToggling(false);
    }
  }

  async function handleDeactivate() {
    if (!profile || accountBusy) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setAccountBusy(true);
    setAccountError(null);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_deactivated: true,
          deactivated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);
      if (error) throw error;
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setAccountError("Could not deactivate your account. Please try again.");
    } finally {
      setAccountBusy(false);
    }
  }

  async function handleDelete() {
    if (!profile || accountBusy || deleteConfirm !== "DELETE") return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setAccountBusy(true);
    setAccountError(null);
    try {
      // Delete the user's storage files first via the Storage API.
      // (Supabase blocks direct DELETE on storage.objects, so the
      // delete_my_account() RPC cannot remove files itself.)
      const uid = profile.id;
      const folders = [
        uid,
        `${uid}/videos`,
        `${uid}/comments`,
        `avatars/${uid}`,
        `covers/${uid}`,
      ];
      for (const folder of folders) {
        const { data: files } = await supabase.storage
          .from("post-images")
          .list(folder);
        const paths = (files ?? [])
          .filter((f) => f.id)
          .map((f) => `${folder}/${f.name}`);
        if (paths.length > 0) {
          const { error: removeError } = await supabase.storage
            .from("post-images")
            .remove(paths);
          if (removeError) throw removeError;
        }
      }
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setAccountError("Could not delete your account. Please try again.");
    } finally {
      setAccountBusy(false);
    }
  }

  async function handleSignOutEverywhere() {
    if (!profile || accountBusy) return;
    const ok = window.confirm(
      "Sign out of all devices? You will be logged out everywhere, including this device."
    );
    if (!ok) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setAccountBusy(true);
    setAccountError(null);
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      router.push("/login");
      router.refresh();
    } catch {
      setAccountError("Could not sign out everywhere. Please try again.");
    } finally {
      setAccountBusy(false);
    }
  }

  // When the next username change is allowed (null = allowed now).
  const usernameCooldownUntil = (() => {
    if (!profile?.username_changed_at) return null;
    const next = new Date(
      new Date(profile.username_changed_at).getTime() + 3 * 24 * 60 * 60 * 1000
    );
    return next > new Date() ? next : null;
  })();

  /**
   * Renames the user safely. Login is tied to `${username}@chowk.app`, so the
   * auth email is updated FIRST — if that fails (or Supabase parks it behind
   * an email confirmation the fake address can never complete), the profile
   * is left untouched and the login keeps working. Returns the new
   * username_changed_at timestamp ("" when the tracking column is missing).
   */
  async function applyUsernameChange(
    client: NonNullable<ReturnType<typeof getSupabaseClient>>,
    current: ProfileFull,
    newUsername: string
  ): Promise<string> {
    const newEmail = `${newUsername}@chowk.app`;
    const { data, error } = await client.auth.updateUser({ email: newEmail });
    if (error) throw error;
    if (!data.user || data.user.email?.toLowerCase() !== newEmail) {
      throw new Error("email-confirmation-pending");
    }
    const changedAt = new Date().toISOString();
    const { error: profileError } = await client
      .from("profiles")
      .update({ username: newUsername, username_changed_at: changedAt })
      .eq("id", current.id);
    if (profileError) {
      if (isMissingColumnError(profileError)) {
        // username_change.sql not run yet — apply the rename without tracking.
        const retry = await client
          .from("profiles")
          .update({ username: newUsername })
          .eq("id", current.id);
        if (retry.error) throw retry.error;
        return "";
      }
      throw profileError;
    }
    return changedAt;
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!profile || saving) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const name = editName.trim();
    if (name.length === 0) {
      setSaveError("Please enter your full name.");
      setSaveOk(false);
      return;
    }
    const newUsername = editUsername.trim().toLowerCase();
    const usernameChanged =
      newUsername !== (profile.username ?? "").toLowerCase();
    if (usernameChanged) {
      if (!/^[a-z0-9_]{3,20}$/.test(newUsername)) {
        setSaveError(
          "Username must be 3–20 characters: lowercase letters, numbers, underscore."
        );
        setSaveOk(false);
        return;
      }
      if (usernameCooldownUntil) {
        setSaveError(
          `You can change your username again after ${usernameCooldownUntil.toLocaleDateString()}.`
        );
        setSaveOk(false);
        return;
      }
      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", newUsername)
        .maybeSingle();
      if (taken && (taken as { id: string }).id !== profile.id) {
        setSaveError("This username is already taken.");
        setSaveOk(false);
        return;
      }
    }
    setSaving(true);
    setSaveError(null);
    try {
      let changedAt = profile.username_changed_at ?? null;
      if (usernameChanged) {
        changedAt = await applyUsernameChange(supabase, profile, newUsername);
      }
      const payload = {
        full_name: name,
        bio: editBio.trim() || null,
      };
      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", profile.id);
      if (error) {
        if (isMissingColumnError(error)) {
          // bio.sql not run yet — save everything else.
          const retry = await supabase
            .from("profiles")
            .update({ full_name: name })
            .eq("id", profile.id);
          if (retry.error) throw retry.error;
        } else {
          throw error;
        }
      }
      setProfile({
        ...profile,
        username: usernameChanged ? newUsername : profile.username,
        username_changed_at: changedAt,
        full_name: name,
        bio: editBio.trim() || null,
      });
      setSaveOk(true);
    } catch (err) {
      setSaveError(
        err instanceof Error && err.message === "email-confirmation-pending"
          ? "Could not change your username right now. Please try again later."
          : "Could not save your profile. Please try again."
      );
      setSaveOk(false);
    } finally {
      setSaving(false);
    }
  }

  function handleShare(post: PostRow) {
    // Never expose the author of an anonymous post, even in share drafts.
    // Usernames stay private — use the display name instead.
    const handle =
      !post.is_anonymous && post.profiles?.full_name
        ? post.profiles.full_name
        : "someone";
    try {
      sessionStorage.setItem(
        "chowk-share-draft",
        `Reposted from ${handle}:\n${post.content ?? ""}`
      );
    } catch {
      // Session storage is optional.
    }
    router.push("/feed");
  }

  function handlePinChanged(postId: string, pinned: boolean) {
    const pinnedId = pinned ? postId : null;
    setProfile((prev) => (prev ? { ...prev, pinned_post_id: pinnedId } : prev));
    setPosts((prev) => orderPosts(prev, pinnedId));
  }

  const firstName =
    (profile?.full_name || profile?.username || "").trim().split(/\s+/)[0] ||
    "there";

  // Deep link support: /profile?tab=about (from the account menu's Settings).
  const [initialTab] = useState<ProfileTab>(() => {
    if (typeof window === "undefined") return "posts";
    const t = new URLSearchParams(window.location.search).get("tab");
    return t === "about" || t === "friends" || t === "photos" ? t : "posts";
  });

  return (
    <div className="w-full">
      {loading ? (
        <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-neutral-200">
          <p className="text-sm text-[#6F6B80]">Loading your profile...</p>
        </div>
      ) : profile ? (
        <ProfileView
          profile={profile}
          isOwn
          posts={posts}
          friendCount={friendCount}
          initialTab={initialTab}
          onAvatarChanged={(url) =>
            setProfile((prev) => (prev ? { ...prev, avatar_url: url } : prev))
          }
          headerActions={
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="cursor-pointer rounded-lg bg-[#4F46E5] px-5 py-2 text-[15px] font-semibold text-white transition-colors hover:bg-[#4338CA]"
            >
              Create post
            </button>
          }
          composerCard={
            <ComposerCard
              avatar={
                <Link
                  href="/profile"
                  aria-label="Your profile"
                  className="shrink-0 cursor-pointer rounded-full transition-opacity hover:opacity-90"
                >
                  <Avatar
                    name={profile.full_name || profile.username}
                    avatarUrl={profile.avatar_url ?? null}
                    size="sm"
                  />
                </Link>
              }
              firstName={firstName}
              onOpen={() => setComposerOpen(true)}
              onOpenWithPhotos={() => {
                setPhotoNonce((n) => n + 1);
                setComposerOpen(true);
              }}
            />
          }
          postsList={
            <FeedList
              posts={posts}
              currentUserId={profile.id}
              currentProfile={profile}
              onShare={handleShare}
              pinnedPostId={profile.pinned_post_id}
              onPinChanged={handlePinChanged}
              emptyTitle="You have not posted anything yet."
              emptySubtitle="Your posts will appear here."
            />
          }
          friendsSection={
            <section
              aria-label="Friends"
              className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#211D33]">Friends</h2>
                <div className="flex items-center gap-2">
                  <Link
                    href="/search"
                    className="cursor-pointer rounded-lg bg-[#4F46E5] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA]"
                  >
                    Add friends
                  </Link>
                  <Link
                    href="/friends"
                    className="cursor-pointer text-[15px] font-medium text-[#4F46E5] hover:underline"
                  >
                    {requestCount > 0
                      ? `${requestCount} pending request${requestCount === 1 ? "" : "s"}`
                      : "Manage friends"}
                  </Link>
                </div>
              </div>
              {friends.length === 0 ? (
                <p className="mt-3 text-[15px] text-[#6F6B80]">
                  No friends yet. Find people from Search.
                </p>
              ) : (
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {friends.map((f) => (
                    <FriendRow
                      key={f.id}
                      id={f.id}
                      username={f.username}
                      full_name={f.full_name}
                    />
                  ))}
                </ul>
              )}
            </section>
          }
          aboutExtra={
            <>
              <section
                aria-label="Edit profile"
                className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200"
              >
                <h2 className="text-xl font-bold text-[#211D33]">
                  Edit profile
                </h2>
                <div className="mt-3 flex items-center gap-3">
                  <AvatarMenu
                    isOwn
                    profileId={profile.id}
                    displayName={profile.full_name || profile.username}
                    avatarUrl={profile.avatar_url}
                    onChanged={(url) =>
                      setProfile((prev) =>
                        prev ? { ...prev, avatar_url: url } : prev
                      )
                    }
                  >
                    {profile.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.avatar_url}
                        alt="Your profile photo"
                        className="h-16 w-16 rounded-full object-cover ring-2 ring-neutral-200"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4F46E5] text-2xl font-bold text-white">
                        {(profile.full_name || profile.username)
                          .trim()
                          .charAt(0)
                          .toUpperCase() || "?"}
                      </div>
                    )}
                  </AvatarMenu>
                  <p className="text-sm text-[#6F6B80]">
                    Click your photo to take, upload, or remove it.
                  </p>
                </div>
                <form
                  onSubmit={handleSaveProfile}
                  className="mt-3 flex flex-col gap-3"
                  noValidate
                >
                  {saveError && (
                    <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
                      {saveError}
                    </p>
                  )}
                  {saveOk && (
                    <p className="rounded-xl bg-[#EEF2FF] p-3 text-sm font-medium text-[#4F46E5] ring-1 ring-[#4F46E5]/30">
                      Profile updated.
                    </p>
                  )}
                  <TextField
                    label="Full name"
                    name="editName"
                    type="text"
                    autoComplete="name"
                    value={editName}
                    onChange={(e) => {
                      setEditName(e.target.value);
                      setSaveOk(false);
                    }}
                    maxLength={80}
                  />
                  <div>
                    <TextField
                      label="Username"
                      name="editUsername"
                      type="text"
                      autoComplete="username"
                      value={editUsername}
                      onChange={(e) => {
                        setEditUsername(
                          e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                        );
                        setSaveOk(false);
                      }}
                      maxLength={20}
                    />
                    <p className="mt-1 text-xs text-[#6F6B80]">
                      {usernameCooldownUntil
                        ? `You can change it again after ${usernameCooldownUntil.toLocaleDateString()}.`
                        : "You can change your username once every 3 days."}
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="editBio"
                      className="mb-1.5 block text-sm font-medium text-[#211D33]"
                    >
                      Bio
                    </label>
                    <textarea
                      id="editBio"
                      name="editBio"
                      rows={3}
                      maxLength={150}
                      placeholder="Tell the campus about yourself..."
                      value={editBio}
                      onChange={(e) => {
                        setEditBio(e.target.value);
                        setSaveOk(false);
                      }}
                      className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-base text-[#211D33] placeholder:text-neutral-400 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30"
                    />
                    <p className="mt-1 text-right text-xs text-[#6F6B80]">
                      {editBio.length}/150
                    </p>
                  </div>
                  <SubmitButton busy={saving}>Save changes</SubmitButton>
                </form>
              </section>

              <section
                aria-label="Privacy"
                className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200"
              >
                <h2 className="text-xl font-bold text-[#211D33]">Privacy</h2>
                <button
                  type="button"
                  role="switch"
                  aria-checked={profile.is_private}
                  onClick={handlePrivacyToggle}
                  disabled={toggling}
                  className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-full bg-neutral-50 px-4 py-2 text-sm font-medium text-[#211D33] ring-1 ring-neutral-200 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span
                    className={`flex h-6 w-11 items-center rounded-full px-0.5 transition-colors ${
                      profile.is_private
                        ? "justify-end bg-[#4F46E5]"
                        : "justify-start bg-neutral-300"
                    }`}
                  >
                    <span className="h-5 w-5 rounded-full bg-white shadow" />
                  </span>
                  Private account
                </button>
                <p className="mt-2 text-sm text-[#6F6B80]">
                  {profile.is_private
                    ? "Only your friends can see your posts and profile."
                    : "Anyone on Chowk can see your posts."}
                </p>
              </section>

              <section
                aria-label="Account"
                className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200"
              >
                <h2 className="text-xl font-bold text-[#211D33]">Account</h2>
                <div className="mt-3 flex flex-col gap-2">
                  <Link
                    href="/saved"
                    className="cursor-pointer rounded-lg bg-[#E6E3F0] py-2 text-center text-[15px] font-semibold text-[#211D33] transition-colors hover:bg-neutral-300"
                  >
                    Saved posts
                  </Link>
                  <button
                    type="button"
                    onClick={() => setFeedbackOpen(true)}
                    className="cursor-pointer rounded-lg bg-[#E6E3F0] py-2 text-center text-[15px] font-semibold text-[#211D33] transition-colors hover:bg-neutral-300"
                  >
                    Report a problem
                  </button>
                  <a
                    href="https://mail.google.com/mail/?view=cm&fs=1&to=contactnowmuhammadharis@gmail.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer rounded-lg bg-[#E6E3F0] py-2 text-center text-[15px] font-semibold text-[#211D33] transition-colors hover:bg-neutral-300"
                  >
                    Contact support
                  </a>
                  <LogoutButton />
                </div>
              </section>

              <section
                aria-label="Account status"
                className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200"
              >
                <h2 className="text-xl font-bold text-[#211D33]">
                  Account status
                </h2>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountError(null);
                      void handleSignOutEverywhere();
                    }}
                    className="cursor-pointer rounded-lg bg-[#E6E3F0] py-2 text-center text-[15px] font-semibold text-[#211D33] transition-colors hover:bg-neutral-300"
                  >
                    {accountBusy ? "Signing out..." : "Sign out of all devices"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountError(null);
                      setDeactOpen(true);
                    }}
                    className="cursor-pointer rounded-lg bg-[#E6E3F0] py-2 text-center text-[15px] font-semibold text-[#211D33] transition-colors hover:bg-neutral-300"
                  >
                    Deactivate account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountError(null);
                      setDeleteConfirm("");
                      setDeleteOpen(true);
                    }}
                    className="cursor-pointer rounded-lg bg-[#E6E3F0] py-2 text-center text-[15px] font-semibold text-[#211D33] transition-colors hover:bg-neutral-300"
                  >
                    Delete account
                  </button>
                </div>
              </section>
            </>
          }
          composerModal={
            <PostComposerModal
              open={composerOpen}
              onClose={() => setComposerOpen(false)}
              onPosted={() => {
                setComposerOpen(false);
                void load();
              }}
              authorProfile={profile}
              photoNonce={photoNonce}
            />
          }
        />
      ) : (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-[#6F6B80] ring-1 ring-neutral-200">
          We could not load your profile.
        </p>
      )}
      {feedbackOpen && (
        <FeedbackModal open onClose={() => setFeedbackOpen(false)} />
      )}
      {deactOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Deactivate account"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDeactOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[#211D33]">
              Deactivate account?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6F6B80]">
              Your profile and posts will be hidden from everyone. You can
              reactivate your account within 7 days by logging in again —
              after that it cannot be restored.
            </p>
            {accountError && (
              <p className="mt-2 text-sm font-medium text-red-600">
                {accountError}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDeactOpen(false)}
                disabled={accountBusy}
                className="flex-1 cursor-pointer rounded-xl bg-[#E6E3F0] py-2.5 text-sm font-bold text-[#211D33] transition-colors hover:bg-neutral-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={accountBusy}
                className="flex-1 cursor-pointer rounded-xl bg-[#4F46E5] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {accountBusy ? "Deactivating..." : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Delete account"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDeleteOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[#211D33]">
              Delete account permanently?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6F6B80]">
              This will permanently delete your profile, posts, comments,
              messages, friends and everything else. This cannot be undone.
              Type <span className="font-bold text-[#211D33]">DELETE</span> to
              confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE"
              autoComplete="off"
              className="mt-3 w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm text-[#211D33] placeholder:text-neutral-400 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30"
            />
            {accountError && (
              <p className="mt-2 text-sm font-medium text-red-600">
                {accountError}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={accountBusy}
                className="flex-1 cursor-pointer rounded-xl bg-[#E6E3F0] py-2.5 text-sm font-bold text-[#211D33] transition-colors hover:bg-neutral-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={accountBusy || deleteConfirm !== "DELETE"}
                className="flex-1 cursor-pointer rounded-xl bg-[#211D33] py-2.5 text-sm font-bold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {accountBusy ? "Deleting..." : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
