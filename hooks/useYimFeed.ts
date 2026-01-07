import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";
import { getTodayPacificIsoDate } from "@/lib/timezone";
import type { BackgroundType, FontColor, FontSize, FontStyle, Post, TextHighlight } from "@/components/posts/yim-post";

/**
 * YIM feed + post mutation hooks (native).
 *
 * Notes:
 * - Mirrors the web MVP behavior, but keeps the implementation RN-friendly.
 * - Uses in-memory caches for signed URLs to avoid flicker.
 * - Keeps debug logs to make Supabase/RLS issues easier to diagnose.
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
  photo_background_url?: string | null; // storage path
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
const SIGNED_URL_TTL_MS = 23 * 60 * 60 * 1000; // ~23h (slightly less than 24h)

const avatarSignedUrlCache = new Map<string, SignedUrlCacheEntry>();
const AVATAR_SIGNED_URL_TTL_MS = 23 * 60 * 60 * 1000; // keep consistent with post photos

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
  return [
    "lime",
    "pink",
    "sunset",
    "cyber",
    "dark",
    "golden",
    "dreamy",
    "cloudy",
    "collage",
    "floral",
    "ocean",
    "cotton",
    "photo",
  ].includes(value);
}

async function createSignedUrlForPath(path: string) {
  const now = Date.now();
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAtMs > now) return cached.url;

  const { data, error } = await supabase.storage.from("post-photos").createSignedUrl(path, 24 * 60 * 60);
  if (error || !data?.signedUrl) {
    console.warn("[useYimFeed] createSignedUrlForPath failed", { path, error });
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
    console.warn("[useYimFeed] createSignedUrlForAvatarPath failed", { path, error });
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
    console.warn("[useYimFeed] hydrateAuthorInfo profiles fetch failed", error);
    // Fall back to generic labels
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

  // Ensure any missing author IDs still have a label
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
  };
}

export interface CreateYimPostInput {
  quote: string;
  attribution?: string;
  background: BackgroundType;
  font?: FontStyle;
  fontColor?: FontColor;
  fontSize?: FontSize;
  textHighlight?: TextHighlight;
  photoBackgroundPath?: string; // storage path
  expandedText?: string;
  promptId?: string;
  promptDate?: string; // YYYY-MM-DD
}

export async function createYimPost(input: CreateYimPostInput): Promise<Post> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("[createYimPost] Must be authenticated");

  const insertData: Record<string, unknown> = {
    author_id: user.id,
    quote: input.quote,
    attribution: input.attribution ?? "",
    background: input.background,
    font: input.font ?? null,
    font_color: input.fontColor ?? null,
    font_size: input.fontSize ?? null,
    text_highlight: input.textHighlight ?? null,
    expanded_text: input.expandedText ?? null,
    prompt_id: input.promptId ?? null,
    prompt_date: input.promptDate ?? (input.promptId ? getTodayPacificIsoDate() : null),
  };

  if (input.photoBackgroundPath) insertData.photo_background_url = input.photoBackgroundPath;

  if (__DEV__) console.log("[createYimPost] insert", { keys: Object.keys(insertData) });

  const { data, error } = await supabase
    .from("yim_posts")
    .insert(insertData)
    .select(
      "id, author_id, quote, attribution, background, font, font_color, font_size, text_highlight, photo_background_url, expanded_text, prompt_id, prompt_date, created_at"
    )
    .single();

  if (error) throw error;
  if (!data) throw new Error("[createYimPost] No data returned");

  const signedUrlMap = await hydrateSignedUrls([data as YimPostRow]);
  const authorInfoMap = await hydrateAuthorInfo([(data as YimPostRow).author_id]);
  return mapRowToPost(data as YimPostRow, signedUrlMap, authorInfoMap);
}

export async function updatePostExpandedText(params: { postId: string; expandedText: string }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("[updatePostExpandedText] Must be authenticated");

  const { error } = await supabase
    .from("yim_posts")
    .update({ expanded_text: params.expandedText || null })
    .eq("id", params.postId);

  if (error) throw error;
}

export function useYimFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refetch = useCallback(async (forceRefresh = false) => {
    setErrorMessage(null);
    if (!forceRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPosts([]);
        return;
      }

      // MVP: show user's own posts + friend posts by accepted friendships.
      const { data: friendships, error: friendshipsError } = await supabase
        .from("friendships")
        .select("user_id, friend_id, status")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq("status", "accepted");

      if (friendshipsError) {
        console.warn("[useYimFeed] friendships fetch failed", friendshipsError);
      }

      const friendIds =
        friendships?.map((f) => (f.user_id === user.id ? f.friend_id : f.user_id)).filter(Boolean) ?? [];
      const authorIds = Array.from(new Set([...friendIds, user.id]));

      let query = supabase
        .from("yim_posts")
        .select(
          "id, author_id, quote, attribution, background, font, font_color, font_size, text_highlight, photo_background_url, expanded_text, prompt_id, prompt_date, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (authorIds.length > 0) query = query.in("author_id", authorIds);

      const { data: rows, error } = await query;
      if (error) throw error;

      const signedUrlMap = await hydrateSignedUrls((rows ?? []) as YimPostRow[]);
      const authorIdsForProfiles = Array.from(new Set(((rows ?? []) as YimPostRow[]).map((r) => r.author_id).filter(Boolean)));
      const authorInfoMap = await hydrateAuthorInfo(authorIdsForProfiles);
      const mapped = ((rows ?? []) as YimPostRow[]).map((r) => mapRowToPost(r, signedUrlMap, authorInfoMap));

      setPosts(mapped);
    } catch (error) {
      console.error("[useYimFeed] refetch failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to load feed");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refetch(true);
  }, [refetch]);

  const addPostOptimistically = useCallback((post: Post) => {
    setPosts((prev) => [post, ...prev]);
  }, []);

  return useMemo(
    () => ({ posts, isLoading, errorMessage, isRefreshing, refetch, addPostOptimistically }),
    [posts, isLoading, errorMessage, isRefreshing, refetch, addPostOptimistically]
  );
}

export function useUserPosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPosts([]);
        return;
      }

      const { data: rows, error } = await supabase
        .from("yim_posts")
        .select(
          "id, author_id, quote, attribution, background, font, font_color, font_size, text_highlight, photo_background_url, expanded_text, prompt_id, prompt_date, created_at"
        )
        .eq("author_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const signedUrlMap = await hydrateSignedUrls((rows ?? []) as YimPostRow[]);
      const authorInfoMap = await hydrateAuthorInfo([user.id]);
      const mapped = ((rows ?? []) as YimPostRow[]).map((r) => mapRowToPost(r, signedUrlMap, authorInfoMap));
      setPosts(mapped);
    } catch (error) {
      console.error("[useUserPosts] refetch failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to load your posts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { posts, isLoading, errorMessage, refetch };
}




