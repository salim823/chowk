"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { notify } from "@/lib/notify";
import { selectWithFallback } from "@/lib/safeSelect";
import { FeedList } from "@/components/FeedList";
import { FollowButton } from "@/components/FollowButton";
import { MessageButton } from "@/components/MessageButton";
import { ProfileView, FriendRow } from "@/components/ProfileView";
import { ReportDialog } from "@/components/ReportDialog";
import { ChowkModal, ChowkModalButton } from "@/components/ChowkModal";
import type {
  FriendshipRow,
  PostRow,
  ProfileFull,
  ProfileLite,
} from "@/lib/types";

type Relation =
  | "none"
  | "pendingSent"
  | "pendingReceived"
  | "accepted"
  | "blockedByMe"
  | "blockedThem";

/** Public profile of another user, Chowk style. */
export default function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const router = useRouter();

  const [me, setMe] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState("Someone");
  const [myProfile, setMyProfile] = useState<ProfileLite | null>(null);
  const [profile, setProfile] = useState<ProfileFull | null>(null);
  const [relation, setRelation] = useState<Relation>("none");
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [friends, setFriends] = useState<(ProfileLite & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);

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
    setMe(user.id);

    const { data: mine } = await supabase
      .from("profiles")
      .select("username, full_name, avatar_url")
      .eq("id", user.id)
      .single();
    const myProf = (mine as ProfileLite | null) ?? null;
    setMyProfile(myProf);
    if (myProf) setMyUsername(myProf.full_name || myProf.username);

    // Resilient: works whether or not cover.sql / pin.sql / bio.sql were run.
    const { data: them } = await selectWithFallback(
      () =>
        supabase
          .from("profiles")
          .select(
            "id, username, full_name, avatar_url, gali, is_private, cover_url, pinned_post_id, bio, is_deactivated, is_deleted"
          )
          .eq("username", username)
          .maybeSingle(),
      () =>
        supabase
          .from("profiles")
          .select(
            "id, username, full_name, avatar_url, gali, is_private"
          )
          .eq("username", username)
          .maybeSingle()
    );
    if (!them) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const their = them as ProfileFull;
    setProfile(their);
    if (their.id === user.id) {
      router.replace("/profile");
      return;
    }

    // Friendship rows in either direction.
    const { data: rows } = await supabase
      .from("friendships")
      .select("*")
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${their.id}),` +
          `and(requester_id.eq.${their.id},addressee_id.eq.${user.id})`
      );
    const list = (rows ?? []) as FriendshipRow[];
    let rel: Relation = "none";
    let fid: string | null = null;
    for (const r of list) {
      if (r.status === "blocked") {
        rel = r.requester_id === user.id ? "blockedByMe" : "blockedThem";
        fid = r.id;
        break;
      }
    }
    if (rel === "none") {
      for (const r of list) {
        if (r.status === "accepted") {
          rel = "accepted";
          fid = r.id;
          break;
        }
        if (r.status === "pending") {
          rel = r.requester_id === user.id ? "pendingSent" : "pendingReceived";
          fid = r.id;
          break;
        }
      }
    }
    setRelation(rel);
    setFriendshipId(fid);

    // Their posts (hidden for private accounts, blocked users, and
    // friends-only posts when we are not friends).
    const postsVisible =
      rel !== "blockedByMe" &&
      rel !== "blockedThem" &&
      (!their.is_private || rel === "accepted");
    if (postsVisible) {
      const { data: postRows } = await supabase
        .from("posts")
        .select("*, profiles!posts_user_id_fkey(username, full_name, avatar_url)")
        .eq("user_id", their.id)
        .order("created_at", { ascending: false })
        .limit(50);
      const all = (postRows ?? []) as PostRow[];
      setPosts(
        orderPosts(
          all.filter((p) => p.audience !== "friends" || rel === "accepted"),
          their.pinned_post_id
        )
      );
    } else {
      setPosts([]);
    }

    // Their friends (ids only, for the list below).
    const { data: frows } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${their.id},addressee_id.eq.${their.id}`)
      .limit(50);
    const otherIds = (
      (frows ?? []) as { requester_id: string; addressee_id: string }[]
    ).map((r) => (r.requester_id === their.id ? r.addressee_id : r.requester_id));
    if (otherIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", otherIds);
      setFriends((profs ?? []) as (ProfileLite & { id: string })[]);
    } else {
      setFriends([]);
    }

    setLoading(false);
  }, [username, router, orderPosts]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setLoading(true);
    await load();
  }

  async function handleAddFriend() {
    if (!me || !profile || busy) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("friendships").insert({
        requester_id: me,
        addressee_id: profile.id,
        status: "pending",
      });
      if (error) throw error;
      void notify({
        user_id: profile.id,
        type: "friend_request",
        title: `${myUsername} sent you a friend request`,
      });
      await refresh();
    } catch {
      // Best-effort.
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelRequest() {
    if (!friendshipId || busy) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusy(true);
    try {
      await supabase.from("friendships").delete().eq("id", friendshipId);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleRespond(accept: boolean) {
    if (!friendshipId || busy) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusy(true);
    try {
      if (accept) {
        await supabase
          .from("friendships")
          .update({ status: "accepted" })
          .eq("id", friendshipId);
      } else {
        await supabase.from("friendships").delete().eq("id", friendshipId);
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleBlock() {
    if (!me || !profile || busy) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusy(true);
    try {
      // Remove any existing rows first, then record the block.
      await supabase
        .from("friendships")
        .delete()
        .or(
          `and(requester_id.eq.${me},addressee_id.eq.${profile.id}),` +
            `and(requester_id.eq.${profile.id},addressee_id.eq.${me})`
        );
      await supabase.from("friendships").insert({
        requester_id: me,
        addressee_id: profile.id,
        status: "blocked",
      });
      setBlockOpen(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleUnblock() {
    if (!me || !profile || busy) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusy(true);
    try {
      await supabase
        .from("friendships")
        .delete()
        .eq("requester_id", me)
        .eq("addressee_id", profile.id)
        .eq("status", "blocked");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleReportUser(reason: string) {
    if (!me || !profile) throw new Error("Not ready");
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Not connected");
    const { error } = await supabase.from("reports").insert({
      reporter_id: me,
      reported_user_id: profile.id,
      reason,
    });
    if (error) throw error;
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

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-neutral-200">
        <p className="text-sm text-[#6F6B80]">Loading profile...</p>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-neutral-200">
        <p className="text-sm font-medium text-[#211D33]">User not found.</p>
        <Link
          href="/search"
          className="mt-2 inline-block cursor-pointer text-sm font-medium text-[#4F46E5] underline transition-colors hover:text-[#4338CA]"
        >
          Back to search
        </Link>
      </div>
    );
  }

  if (profile.is_deactivated || profile.is_deleted) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-neutral-200">
        <p className="text-sm font-medium text-[#211D33]">
          This account is deactivated.
        </p>
        <p className="mt-1 text-sm text-[#6F6B80]">
          This profile is not available right now.
        </p>
      </div>
    );
  }

  if (relation === "blockedThem") {
    return (
      <p className="rounded-2xl bg-white p-6 text-center text-sm text-[#6F6B80] ring-1 ring-neutral-200">
        You cannot view this profile.
      </p>
    );
  }

  const displayName = profile.full_name || profile.username;
  const showPrivateNotice =
    profile.is_private && relation !== "accepted" && relation !== "blockedByMe";
  const postsVisible =
    !showPrivateNotice && relation !== "blockedByMe";

  const headerActions = (
    <>
      {relation === "none" && (
        <>
          <button
            type="button"
            onClick={handleAddFriend}
            disabled={busy}
            className="cursor-pointer rounded-lg bg-[#4F46E5] px-5 py-2 text-[15px] font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add friend
          </button>
          <MessageButton userId={profile.id} />
          {me && (
            <FollowButton me={me} targetId={profile.id} onChanged={() => {}} />
          )}
        </>
      )}
      {relation === "pendingSent" && (
        <>
          <span className="rounded-lg bg-[#E6E3F0] px-4 py-2 text-[15px] font-semibold text-[#211D33]">
            Request sent
          </span>
          <button
            type="button"
            onClick={handleCancelRequest}
            disabled={busy}
            className="cursor-pointer rounded-lg bg-[#E6E3F0] px-4 py-2 text-[15px] font-semibold text-[#211D33] transition-colors hover:bg-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        </>
      )}
      {relation === "pendingReceived" && (
        <>
          <button
            type="button"
            onClick={() => void handleRespond(true)}
            disabled={busy}
            className="cursor-pointer rounded-lg bg-[#4F46E5] px-5 py-2 text-[15px] font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => void handleRespond(false)}
            disabled={busy}
            className="cursor-pointer rounded-lg bg-[#E6E3F0] px-4 py-2 text-[15px] font-semibold text-[#211D33] transition-colors hover:bg-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Decline
          </button>
        </>
      )}
      {relation === "accepted" && (
        <>
          <span className="rounded-lg bg-[#EEF2FF] px-4 py-2 text-[15px] font-semibold text-[#4F46E5]">
            You are friends
          </span>
          <MessageButton userId={profile.id} />
        </>
      )}
      {relation === "blockedByMe" && (
        <button
          type="button"
          onClick={handleUnblock}
          disabled={busy}
          className="cursor-pointer rounded-lg bg-[#4F46E5] px-5 py-2 text-[15px] font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Unblock
        </button>
      )}
    </>
  );

  const notice = (
    <p className="rounded-xl bg-white p-6 text-center text-[15px] text-[#6F6B80] shadow-sm ring-1 ring-neutral-200">
      {relation === "blockedByMe"
        ? "You blocked this user. Unblock them to see their posts again."
        : "This account is private. Only friends can see their posts."}
    </p>
  );

  return (
    <div className="w-full">
      <ProfileView
        profile={profile}
        isOwn={false}
        posts={posts}
        friendCount={friends.length}
        headerActions={headerActions}
        postsList={
          postsVisible && me ? (
            <FeedList
              posts={posts}
              currentUserId={me}
              currentProfile={myProfile}
              onShare={handleShare}
              friendIds={
                new Set(relation === "accepted" ? [profile.id] : [])
              }
              pinnedPostId={profile.pinned_post_id}
              emptyTitle="No posts yet."
            />
          ) : (
            notice
          )
        }
        postsAccessible={postsVisible && !!me}
        lockedNotice={notice}
        friendsSection={
          postsVisible ? (
            <section
              aria-label={`${displayName}'s friends`}
              className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200"
            >
              <h2 className="text-xl font-bold text-[#211D33]">Friends</h2>
              {friends.length === 0 ? (
                <p className="mt-3 text-[15px] text-[#6F6B80]">
                  No friends yet.
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
          ) : (
            notice
          )
        }
        aboutExtra={
          <section
            aria-label="Moderation"
            className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200"
          >
            <h2 className="text-xl font-bold text-[#211D33]">Moderation</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {relation !== "blockedByMe" && (
                <button
                  type="button"
                  onClick={() => setBlockOpen(true)}
                  disabled={busy}
                  className="cursor-pointer rounded-lg bg-[#E6E3F0] px-4 py-2 text-[15px] font-semibold text-[#211D33] transition-colors hover:bg-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Block user
                </button>
              )}
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="cursor-pointer rounded-lg bg-[#E6E3F0] px-4 py-2 text-[15px] font-semibold text-[#211D33] transition-colors hover:bg-neutral-300"
              >
                Report user
              </button>
            </div>
          </section>
        }
      />

      {reportOpen && (
        <ReportDialog
          title={`Report ${profile.full_name || profile.username}`}
          placeholder="Why are you reporting this user?"
          onClose={() => setReportOpen(false)}
          onSubmit={handleReportUser}
        />
      )}

      <ChowkModal
        open={blockOpen}
        onClose={() => {
          if (!busy) setBlockOpen(false);
        }}
        title={`Block ${profile.full_name || profile.username}?`}
        subtitle="Are you sure you want to block this user?"
        size="sm"
        footer={
          <>
            <ChowkModalButton
              tone="neutral"
              disabled={busy}
              onClick={() => setBlockOpen(false)}
            >
              Cancel
            </ChowkModalButton>
            <ChowkModalButton
              tone="dark"
              disabled={busy}
              onClick={() => void handleBlock()}
            >
              {busy ? "Blocking..." : "Block user"}
            </ChowkModalButton>
          </>
        }
      >
        <p className="text-[15px] leading-6 text-[#6F6B80]">
          You will no longer see their posts. You can unblock them any time to
          restore everything.
        </p>
      </ChowkModal>
    </div>
  );
}
