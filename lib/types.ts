/** Slim profile shape embedded in posts / comments. */
export interface ProfileLite {
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  /** Present on chat participants (listConversations). Absent elsewhere. */
  last_active_at?: string | null;
}

export interface PostRow {
  id: string;
  user_id: string;
  content: string | null;
  image_urls: string[] | null;
  is_anonymous: boolean;
  audience: "everyone" | "friends";
  created_at: string;
  profiles: ProfileLite | null;
  /** "Who can comment" setting; absent until comment_audience.sql is run. */
  comment_audience?: "everyone" | "friends" | null;
}

export interface ReactionRow {
  id: string;
  post_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: ProfileLite | null;
  /** Reply target; absent until comment_engagement.sql is run. */
  parent_id?: string | null;
  /** Attached photo URL; absent until comment_images.sql is run. */
  image_url?: string | null;
}

/** A "Like" on a comment. Table created by comment_engagement.sql. */
export interface CommentLikeRow {
  id: string;
  comment_id: string;
  user_id: string;
  created_at: string;
}

/** Full profile row (never expose is_admin to other users' views). */
export interface ProfileFull extends ProfileLite {
  id: string;
  gali: string | null;
  is_private: boolean;
  is_admin: boolean;
  /** Absent until cover.sql is run. */
  cover_url?: string | null;
  /** Absent until pin.sql is run. */
  pinned_post_id?: string | null;
  /** Absent until bio.sql is run. */
  bio?: string | null;
  /** Absent until username_change.sql is run. */
  username_changed_at?: string | null;
  /** Absent until account_status.sql is run. */
  is_deactivated?: boolean | null;
  /** Absent until account_status.sql is run. */
  deactivated_at?: string | null;
  /** Absent until account_status.sql is run. */
  is_deleted?: boolean | null;
}

export interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  post_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AnnouncementRow {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  is_pinned: boolean;
  created_at: string;
  profiles: ProfileLite | null;
}
