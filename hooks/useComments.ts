import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";

/**
 * Hook for managing comments on posts.
 * Provides functionality to fetch, add, and delete comments.
 */

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_username?: string;
  author_first_name?: string;
  author_avatar_url?: string;
  author_label?: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export function commentsQueryKey(postId: string) {
  return ["comments", postId] as const;
}

async function fetchComments(postId: string): Promise<Comment[]> {
  const { data: rows, error } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, content, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const commentRows = rows as CommentRow[];
  const userIds = Array.from(new Set(commentRows.map((c) => c.user_id).filter(Boolean)));

  // Fetch author info for all commenters
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, first_name, avatar_url")
    .in("id", userIds);

  if (profilesError) {
    console.warn("[useComments] fetch profiles failed", profilesError);
  }

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

  // Hydrate avatar URLs
  const commentsWithAvatars = await Promise.all(
    commentRows.map(async (comment) => {
      const profile = profileMap.get(comment.user_id);
      let avatarUrl: string | undefined;

      if (profile?.avatar_url) {
        const { data, error: urlError } = await supabase.storage
          .from("profile-pictures")
          .createSignedUrl(profile.avatar_url, 24 * 60 * 60);

        if (!urlError && data?.signedUrl) {
          avatarUrl = data.signedUrl;
        }
      }

      const authorLabel =
        profile?.first_name || profile?.username || `Friend ${comment.user_id.slice(-4)}`;

      return {
        id: comment.id,
        post_id: comment.post_id,
        user_id: comment.user_id,
        content: comment.content,
        created_at: comment.created_at,
        author_username: profile?.username,
        author_first_name: profile?.first_name,
        author_avatar_url: avatarUrl,
        author_label: authorLabel,
      } as Comment;
    })
  );

  return commentsWithAvatars;
}

export function useComments(postId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: postId ? commentsQueryKey(postId) : ["comments", "disabled"],
    queryFn: () => fetchComments(postId!),
    enabled: !!postId,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !postId) throw new Error("Must be authenticated and have post ID");
      if (content.trim().length === 0) throw new Error("Comment cannot be empty");
      if (content.length > 500) throw new Error("Comment too long");

      const { data, error } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: user.id,
          content: content.trim(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (postId) {
        queryClient.invalidateQueries({ queryKey: commentsQueryKey(postId) });
      }
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!user) throw new Error("Must be authenticated");

      const { error } = await supabase
        .from("post_comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      if (postId) {
        queryClient.invalidateQueries({ queryKey: commentsQueryKey(postId) });
      }
    },
  });

  const addComment = useCallback(
    async (content: string) => {
      await addCommentMutation.mutateAsync(content);
    },
    [addCommentMutation]
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      await deleteCommentMutation.mutateAsync(commentId);
    },
    [deleteCommentMutation]
  );

  return useMemo(
    () => ({
      comments: query.data ?? [],
      isLoading: query.isLoading,
      errorMessage: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null,
      refetch: query.refetch,
      addComment,
      deleteComment,
      isAdding: addCommentMutation.isPending,
      isDeleting: deleteCommentMutation.isPending,
      canDelete: (comment: Comment) => user?.id === comment.user_id,
    }),
    [
      query.data,
      query.isLoading,
      query.error,
      query.refetch,
      addComment,
      deleteComment,
      addCommentMutation.isPending,
      deleteCommentMutation.isPending,
      user?.id,
    ]
  );
}
