import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { BackgroundType, FontColor, FontSize, FontStyle, Post, TextHighlight } from "@/components/posts/yim-post";
import { useAuth } from "@/providers/auth-provider";

/**
 * Hook for managing saved posts.
 * Provides functionality to fetch saved posts and toggle save status.
 */

interface YimPostRow {
  id: string;
  author_id: string;
  quote: string;
  attribution: string | null;
  background: string | null;
  font: string | null;
  font_color: string | null;
  font_size: string | null;
  text_highlight?: string | null;
  photo_background_url?: string | null;
  expanded_text?: string | null;
  prompt_id?: string | null;
  prompt_date?: string | null;
  created_at: string;
}

interface SignedUrlCacheEntry {
  url: string;
  expiresAtMs: number;
}

const signedUrlCache = new Map<string, SignedUrlCacheEntry>();
const SIGNED_URL_TTL_MS = 23 * 60 * 60 * 1000;

const avatarSignedUrlCache = new Map<string, SignedUrlCacheEntry>();
const AVATAR_SIGNED_URL_TTL_MS = 23 * 60 * 60 * 1000;

function isAllowedFontStyle(value: string | null): value is FontStyle {
  if (!value) return false;
  return ["bebas", "playfair", "archivo", "marker", "caveat", "canela"].includes(value);
}

function isAllowedFontColor(value: string | null): value is FontColor {
  if (!value) return false;
  return value === "black" || value === "white";
}

function isAllowedFontSize(value: string | null): value is FontSize {
  if (!value) return false;
  return ["small", "medium", "large", "xlarge"].includes(value);
}

function isAllowedHighlight(value: string | null | undefined): value is TextHighlight {
  if (!value) return false;
  return value === "white" || value === "black";
}

function isAllowedBackground(value: string | null): value is BackgroundType {
  if (!value) return false;
  return ["lime", "pink", "sunset", "cyber", "dark", "golden", "dreamy", "cloudy", "collage", "floral", "ocean", "cotton", "photo"].includes(value);
}

async function createSignedUrlForPath(path: string) {
  const now = Date.now();
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAtMs > now) return cached.url;

  const { data, error } = await supabase.storage.from("post-photos").createSignedUrl(path, 24 * 60 * 60);
  if (error || !data?.signedUrl) {
    console.warn("[useSavedPosts] createSignedUrlForPath failed", { path, error });
    return null;
  }

  signedUrlCache.set(path, { url: data.signedUrl, expiresAtMs: now + SIGNED_URL_TTL_MS });
  return data.signedUrl;
}

async function createSignedUrlForAvatarPath(path: string) {
  const now = Date.now();
  const cached = avatarSignedUrlCache.get(path);
  if (cached && cached.expiresAtMs > now) return cached.url;

  const { data, error } = await supabase.storage.from("profile-pictures").createSignedUrl(path, 24 * 60 * 60);
  if (error || !data?.signedUrl) {
    console.warn("[useSavedPosts] createSignedUrlForAvatarPath failed", { path, error });
    return null;
  }

  avatarSignedUrlCache.set(path, { url: data.signedUrl, expiresAtMs: now + AVATAR_SIGNED_URL_TTL_MS });
  return data.signedUrl;
}

async function hydrateSignedUrls(rows: YimPostRow[]) {
  const map = new Map<string, string>();
  const paths = rows.map((r) => r.photo_background_url).filter(Boolean) as string[];
  if (paths.length === 0) return map;

  await Promise.all(
    paths.map(async (path) => {
      const url = await createSignedUrlForPath(path);
      if (url) map.set(path, url);
    })
  );

  return map;
}

type AuthorProfileRow = {
  id: string;
  username: string | null;
  first_name: string | null;
  avatar_url: string | null;
};

type AuthorInfo = {
  authorLabel: string;
  authorUsername?: string;
  authorAvatarUrl?: string;
};

async function hydrateAuthorInfo(authorIds: string[]) {
  const map = new Map<string, AuthorInfo>();
  if (authorIds.length === 0) return map;

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, username, first_name, avatar_url")
    .in("id", authorIds);

  if (error) {
    console.warn("[useSavedPosts] hydrateAuthorInfo profiles fetch failed", error);
    authorIds.forEach((id) => map.set(id, { authorLabel: `Friend ${id.slice(-4)}` }));
    return map;
  }

  const rows = (profiles ?? []) as AuthorProfileRow[];

  await Promise.all(
    rows.map(async (p) => {
      const authorLabel = p.first_name || p.username || `Friend ${p.id.slice(-4)}`;
      const avatarUrl = p.avatar_url ? await createSignedUrlForAvatarPath(p.avatar_url) : null;
      map.set(p.id, {
        authorLabel,
        authorUsername: p.username ?? undefined,
        authorAvatarUrl: avatarUrl ?? undefined,
      });
    })
  );

  authorIds.forEach((id) => {
    if (!map.has(id)) map.set(id, { authorLabel: `Friend ${id.slice(-4)}` });
  });

  return map;
}

function formatPostDate(createdAt: string) {
  const d = new Date(createdAt);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function mapRowToPost(row: YimPostRow, signedUrlMap: Map<string, string>, authorInfoMap: Map<string, AuthorInfo>): Post {
  const bg: BackgroundType = isAllowedBackground(row.background) ? row.background : "dark";
  const font = isAllowedFontStyle(row.font) ? row.font : undefined;
  const fontColor = isAllowedFontColor(row.font_color) ? row.font_color : undefined;
  const fontSize = isAllowedFontSize(row.font_size) ? row.font_size : undefined;
  const textHighlight = isAllowedHighlight(row.text_highlight) ? row.text_highlight : undefined;

  const photoBackgroundUrl =
    row.photo_background_url && signedUrlMap.get(row.photo_background_url)
      ? signedUrlMap.get(row.photo_background_url)
      : undefined;

  const authorInfo = authorInfoMap.get(row.author_id);

  return {
    id: row.id,
    quote: row.quote,
    attribution: row.attribution ?? undefined,
    date: formatPostDate(row.created_at),
    background: row.photo_background_url ? "photo" : bg,
    font,
    fontColor,
    fontSize,
    textHighlight,
    photoBackgroundUrl,
    expandedText: row.expanded_text ?? undefined,
    authorId: row.author_id,
    authorLabel: authorInfo?.authorLabel,
    authorUsername: authorInfo?.authorUsername,
    authorAvatarUrl: authorInfo?.authorAvatarUrl,
    promptId: row.prompt_id ?? undefined,
    promptDate: row.prompt_date ?? undefined,
  };
}

export function savedPostsQueryKey(userId: string) {
  return ["savedPosts", userId] as const;
}

async function fetchSavedPosts(userId: string): Promise<Post[]> {
  // First, get all saved post IDs for this user
  const { data: saves, error: savesError } = await supabase
    .from("post_saves")
    .select("post_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (savesError) throw savesError;
  if (!saves || saves.length === 0) return [];

  const postIds = saves.map((s) => s.post_id);

  // Fetch the actual posts
  const { data: rows, error: postsError } = await supabase
    .from("yim_posts")
    .select(
      "id, author_id, quote, attribution, background, font, font_color, font_size, text_highlight, photo_background_url, expanded_text, prompt_id, prompt_date, created_at"
    )
    .in("id", postIds)
    .order("created_at", { ascending: false });

  if (postsError) throw postsError;
  if (!rows || rows.length === 0) return [];

  // Hydrate signed URLs and author info
  const signedUrlMap = await hydrateSignedUrls(rows as YimPostRow[]);
  const authorIds = Array.from(new Set(rows.map((r) => r.author_id).filter(Boolean)));
  const authorInfoMap = await hydrateAuthorInfo(authorIds);

  return (rows as YimPostRow[]).map((r) => mapRowToPost(r, signedUrlMap, authorInfoMap));
}

export function useSavedPosts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: userId ? savedPostsQueryKey(userId) : ["savedPosts", "anonymous"],
    queryFn: () => fetchSavedPosts(userId as string),
    enabled: !!userId,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ postId, save }: { postId: string; save: boolean }) => {
      if (!userId) throw new Error("Must be authenticated");

      if (save) {
        const { error } = await supabase.from("post_saves").insert({
          post_id: postId,
          user_id: userId,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("post_saves")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      // Invalidate saved posts query
      if (userId) {
        queryClient.invalidateQueries({ queryKey: savedPostsQueryKey(userId) });
      }
    },
  });

  const toggleSave = useCallback(
    async (postId: string, currentSaveStatus: boolean) => {
      await saveMutation.mutateAsync({ postId, save: !currentSaveStatus });
    },
    [saveMutation]
  );

  const checkIsSaved = useCallback(
    async (postId: string): Promise<boolean> => {
      if (!userId || !postId) return false;

      const { data, error } = await supabase
        .from("post_saves")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.warn("[useSavedPosts] checkIsSaved failed", error);
        return false;
      }

      return !!data;
    },
    [userId]
  );

  return useMemo(
    () => ({
      posts: query.data ?? [],
      isLoading: query.isLoading,
      errorMessage: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null,
      refetch: query.refetch,
      toggleSave,
      checkIsSaved,
      isSaving: saveMutation.isPending,
    }),
    [query.data, query.isLoading, query.error, query.refetch, toggleSave, checkIsSaved, saveMutation.isPending]
  );
}
