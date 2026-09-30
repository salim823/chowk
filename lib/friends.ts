import type { SupabaseClient } from "@supabase/supabase-js";
import type { FriendshipRow, ProfileLite } from "./types";

export type ReceivedRequest = FriendshipRow & {
  requester: (ProfileLite & { id: string }) | null;
};

export type FriendData = {
  /** Ids of users with an accepted friendship with me (either direction). */
  acceptedIds: Set<string>;
  /** Ids of users blocked in either direction. */
  blockedIds: Set<string>;
  /** Ids I sent a pending request to. */
  pendingSentIds: Set<string>;
  /** Pending requests I received, with requester profiles. */
  receivedRequests: ReceivedRequest[];
};

/**
 * Loads every friendship row involving the user and buckets the other
 * party's id by status. Used for feed filtering and privacy checks.
 */
export async function getMyFriendData(
  supabase: SupabaseClient,
  userId: string
): Promise<FriendData> {
  const acceptedIds = new Set<string>();
  const blockedIds = new Set<string>();
  const pendingSentIds = new Set<string>();
  const receivedRequests: ReceivedRequest[] = [];

  const { data } = await supabase
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  const rows = (data ?? []) as FriendshipRow[];

  const requesterIds: string[] = [];
  for (const row of rows) {
    const other =
      row.requester_id === userId ? row.addressee_id : row.requester_id;
    if (row.status === "accepted") {
      acceptedIds.add(other);
    } else if (row.status === "blocked") {
      blockedIds.add(other);
    } else if (row.status === "pending") {
      if (row.requester_id === userId) pendingSentIds.add(other);
      else requesterIds.push(row.requester_id);
    }
  }

  if (requesterIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", requesterIds);
    const byId = new Map(
      ((profs ?? []) as (ProfileLite & { id: string })[]).map((p) => [p.id, p])
    );
    for (const row of rows) {
      if (row.status === "pending" && row.addressee_id === userId) {
        receivedRequests.push({
          ...row,
          requester: byId.get(row.requester_id) ?? null,
        });
      }
    }
  }

  return { acceptedIds, blockedIds, pendingSentIds, receivedRequests };
}

/** Ids of accepted friends (either direction), capped at `limit`. */
export async function getAcceptedFriendIds(
  supabase: SupabaseClient,
  userId: string,
  limit = 100
): Promise<string[]> {
  const { data } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .limit(limit);
  return ((data ?? []) as { requester_id: string; addressee_id: string }[]).map(
    (r) => (r.requester_id === userId ? r.addressee_id : r.requester_id)
  );
}
