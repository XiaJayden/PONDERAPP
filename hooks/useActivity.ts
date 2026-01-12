import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";

/**
 * Hook for fetching and managing activity notifications.
 */

export interface ActivityNotification {
  id: string;
  user_id: string;
  actor_id: string;
  post_id: string | null;
  notification_type: "like" | "comment" | "save";
  comment_id: string | null;
  read_at: string | null;
  created_at: string;
  actor_username?: string;
  actor_first_name?: string;
  actor_avatar_url?: string;
  actor_label?: string;
  post_quote?: string;
  comment_content?: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  actor_id: string;
  post_id: string | null;
  notification_type: string;
  comment_id: string | null;
  read_at: string | null;
  created_at: string;
}

export function activityQueryKey(userId: string) {
  return ["activity", userId] as const;
}

async function fetchActivity(userId: string): Promise<ActivityNotification[]> {
  const { data: rows, error } = await supabase
    .from("notifications")
    .select("id, user_id, actor_id, post_id, notification_type, comment_id, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.warn("[useActivity] fetchActivity error:", error);
    throw error;
  }
  
  if (!rows || rows.length === 0) {
    if (__DEV__) {
      console.log("[useActivity] No notifications found for user:", userId);
    }
    return [];
  }
  
  if (__DEV__) {
    console.log("[useActivity] Found", rows.length, "notifications for user:", userId);
  }

  const notificationRows = rows as NotificationRow[];
  const actorIds = Array.from(new Set(notificationRows.map((n) => n.actor_id).filter(Boolean)));
  const postIds = Array.from(new Set(notificationRows.map((n) => n.post_id).filter(Boolean)));
  const commentIds = Array.from(
    new Set(notificationRows.map((n) => n.comment_id).filter(Boolean))
  );

  // Fetch actor profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, first_name, avatar_url")
    .in("id", actorIds);

  const profileMap = new Map<string, { username?: string; first_name?: string; avatar_url?: string }>();
  if (profiles) {
    profiles.forEach((p) => {
      profileMap.set(p.id, {
        username: p.username ?? undefined,
        first_name: p.first_name ?? undefined,
        avatar_url: p.avatar_url ?? undefined,
      });
    });
  }

  // Fetch post quotes (for display)
  const { data: posts } = await supabase
    .from("yim_posts")
    .select("id, quote")
    .in("id", postIds);

  const postMap = new Map<string, string>();
  if (posts) {
    posts.forEach((p) => {
      postMap.set(p.id, p.quote);
    });
  }

  // Fetch comment content
  const { data: comments } = await supabase
    .from("post_comments")
    .select("id, content")
    .in("id", commentIds);

  const commentMap = new Map<string, string>();
  if (comments) {
    comments.forEach((c) => {
      commentMap.set(c.id, c.content);
    });
  }

  // Hydrate avatar URLs and build notifications
  const notifications = await Promise.all(
    notificationRows.map(async (row) => {
      const profile = profileMap.get(row.actor_id);
      let avatarUrl: string | undefined;

      if (profile?.avatar_url) {
        const { data, error: urlError } = await supabase.storage
          .from("profile-pictures")
          .createSignedUrl(profile.avatar_url, 24 * 60 * 60);

        if (!urlError && data?.signedUrl) {
          avatarUrl = data.signedUrl;
        }
      }

      const actorLabel = profile?.first_name || profile?.username || `Friend ${row.actor_id.slice(-4)}`;

      return {
        id: row.id,
        user_id: row.user_id,
        actor_id: row.actor_id,
        post_id: row.post_id,
        notification_type: row.notification_type as "like" | "comment" | "save",
        comment_id: row.comment_id,
        read_at: row.read_at,
        created_at: row.created_at,
        actor_username: profile?.username,
        actor_first_name: profile?.first_name,
        actor_avatar_url: avatarUrl,
        actor_label: actorLabel,
        post_quote: row.post_id ? postMap.get(row.post_id) : undefined,
        comment_content: row.comment_id ? commentMap.get(row.comment_id) : undefined,
      } as ActivityNotification;
    })
  );

  return notifications;
}

export function useActivity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: userId ? activityQueryKey(userId) : ["activity", "anonymous"],
    queryFn: () => {
      if (__DEV__) {
        console.log("[useActivity] Fetching activity for user:", userId);
      }
      return fetchActivity(userId as string);
    },
    enabled: !!userId,
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true, // Refetch when app comes to foreground
    refetchOnMount: true, // Refetch when component mounts
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!userId) throw new Error("Must be authenticated");

      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: activityQueryKey(userId) });
      }
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Must be authenticated");

      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);

      if (error) throw error;
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: activityQueryKey(userId) });
      }
    },
  });

  const unreadCount = query.data?.filter((n) => !n.read_at).length ?? 0;

  return {
    notifications: query.data ?? [],
    isLoading: query.isLoading,
    errorMessage: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null,
    refetch: query.refetch,
    markAsRead: markAsReadMutation.mutateAsync,
    markAllAsRead: markAllAsReadMutation.mutateAsync,
    unreadCount,
  };
}
