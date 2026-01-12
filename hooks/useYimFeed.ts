import { useCallback, useEffect, useMemo, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getPacificIsoDateForCycleStart, getTodayPacificIsoDate } from "@/lib/timezone";
import type { BackgroundType, FontColor, FontSize, FontStyle, Post, TextHighlight } from "@/components/posts/yim-post";
import { useAuth } from "@/providers/auth-provider";

/**
 * YIM feed + post mutation hooks (native).
 *
 * Notes:
 * - Mirrors the web MVP behavior, but keeps the implementation RN-friendly.
 * - Uses in-memory caches for signed URLs to avoid flicker.
 * - Keeps debug logs to make Supabase/RLS issues easier to diagnose.
 */

export interface YimPostRow {
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

export async function hydrateSignedUrls(rows: YimPostRow[]) {
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

export async function hydrateAuthorInfo(authorIds: string[]) {
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

export function mapRowToPost(row: YimPostRow, signedUrlMap: Map<string, string>, authorInfoMap: Map<string, AuthorInfo>): Post {
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

function countWords(text: string | null | undefined): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

export async function createYimPost(input: CreateYimPostInput): Promise<Post> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("[createYimPost] Must be authenticated");

  // Calculate word count from quote and expandedText
  const wordCount = countWords(input.quote) + countWords(input.expandedText);

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
    word_count: wordCount,
  };

  if (input.photoBackgroundPath) insertData.photo_background_url = input.photoBackgroundPath;

  if (__DEV__) console.log("[createYimPost] insert", { keys: Object.keys(insertData) });

  const { data, error } = await supabase
    .from("yim_posts")
    .insert(insertData)
    .select(
      "id, author_id, quote, attribution, background, font, font_color, font_size, text_highlight, photo_background_url, expanded_text, prompt_id, prompt_date, word_count, created_at"
    )
    .single();

  if (error) throw error;
  if (!data) throw new Error("[createYimPost] No data returned");

  const signedUrlMap = await hydrateSignedUrls([data as YimPostRow]);
  const authorInfoMap = await hydrateAuthorInfo([(data as YimPostRow).author_id]);
  const post = mapRowToPost(data as YimPostRow, signedUrlMap, authorInfoMap);

  // Track post creation event
  try {
    await supabase.from("user_events").insert({
      user_id: user.id,
      event_type: "post_created",
      event_name: "post_created",
      metadata: {
        post_id: post.id,
        prompt_id: input.promptId ?? null,
        word_count: wordCount,
      },
    });
  } catch (error) {
    // Non-critical, just log
    if (__DEV__) console.warn("[createYimPost] event tracking failed", error);
  }

  return post;
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

function addDaysToIsoDate(isoDate: string, deltaDays: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`[useYimFeed] Invalid ISO date: ${isoDate}`);
  const [, y, m, d] = match;
  const ms = Date.UTC(Number(y), Number(m) - 1, Number(d) + deltaDays, 12, 0, 0);
  const dd = new Date(ms);
  const yy = dd.getUTCFullYear();
  const mm = String(dd.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dd.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${day}`;
}

export function yimFeedQueryKey(userId: string, promptDate: string) {
  return ["yimFeed", userId, promptDate] as const;
}

export function allPostsFeedQueryKey(userId: string) {
  return ["yimFeed", userId, "all"] as const;
}

export async function fetchAllPosts(userId: string): Promise<Post[]> {
  // Fetch ALL posts for user + friends (ignores date filter - for dev testing)
  const authorIds = await fetchAuthorIdsForUser(userId);

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

  if (__DEV__) {
    console.log("[fetchAllPosts] found", rows?.length ?? 0, "posts");
    rows?.forEach((r: any) => console.log("[fetchAllPosts] post", { id: r.id, prompt_date: r.prompt_date, author_id: r.author_id }));
  }

  const signedUrlMap = await hydrateSignedUrls((rows ?? []) as YimPostRow[]);
  const authorIdsForProfiles = Array.from(
    new Set(((rows ?? []) as YimPostRow[]).map((r) => r.author_id).filter(Boolean))
  );
  const authorInfoMap = await hydrateAuthorInfo(authorIdsForProfiles);
  return ((rows ?? []) as YimPostRow[]).map((r) => mapRowToPost(r, signedUrlMap, authorInfoMap));
}

export function pendingPostQueryKey(userId: string, promptDate: string) {
  return ["pendingPost", userId, promptDate] as const;
}

async function fetchAuthorIdsForUser(userId: string) {
  const { data: friendships, error: friendshipsError } = await supabase
    .from("friendships")
    .select("user_id, friend_id, status")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq("status", "accepted");

  if (friendshipsError) {
    console.warn("[fetchYimFeed] friendships fetch failed", friendshipsError);
  }

  const friendIds =
    friendships?.map((f) => (f.user_id === userId ? f.friend_id : f.user_id)).filter(Boolean) ?? [];
  return Array.from(new Set([...friendIds, userId]));
}

export async function fetchYimFeed(userId: string, promptDate: string): Promise<Post[]> {
  // Single-login daily cycle: show "yesterday" posts (prompt_date = promptDate) for user + friends.
  const authorIds = await fetchAuthorIdsForUser(userId);

  let query = supabase
    .from("yim_posts")
    .select(
      "id, author_id, quote, attribution, background, font, font_color, font_size, text_highlight, photo_background_url, expanded_text, prompt_id, prompt_date, created_at"
    )
    .eq("prompt_date", promptDate)
    .order("created_at", { ascending: false })
    .limit(50);

  if (authorIds.length > 0) query = query.in("author_id", authorIds);

  const { data: rows, error } = await query;
  if (error) throw error;

  const signedUrlMap = await hydrateSignedUrls((rows ?? []) as YimPostRow[]);
  const authorIdsForProfiles = Array.from(
    new Set(((rows ?? []) as YimPostRow[]).map((r) => r.author_id).filter(Boolean))
  );
  const authorInfoMap = await hydrateAuthorInfo(authorIdsForProfiles);
  return ((rows ?? []) as YimPostRow[]).map((r) => mapRowToPost(r, signedUrlMap, authorInfoMap));
}

export async function fetchPendingPost(userId: string, promptDate: string): Promise<Post | null> {
  const { data: row, error } = await supabase
    .from("yim_posts")
    .select(
      "id, author_id, quote, attribution, background, font, font_color, font_size, text_highlight, photo_background_url, expanded_text, prompt_id, prompt_date, created_at"
    )
    .eq("author_id", userId)
    .eq("prompt_date", promptDate)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!row) return null;

  const signedUrlMap = await hydrateSignedUrls([row as YimPostRow]);
  const authorInfoMap = await hydrateAuthorInfo([userId]);
  return mapRowToPost(row as YimPostRow, signedUrlMap, authorInfoMap);
}

export function userPostsQueryKey(userId: string) {
  return ["userPosts", userId] as const;
}

export async function fetchUserPosts(userId: string): Promise<Post[]> {
  const { data: rows, error } = await supabase
    .from("yim_posts")
    .select(
      "id, author_id, quote, attribution, background, font, font_color, font_size, text_highlight, photo_background_url, expanded_text, prompt_id, prompt_date, created_at"
    )
    .eq("author_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  const signedUrlMap = await hydrateSignedUrls((rows ?? []) as YimPostRow[]);
  const authorInfoMap = await hydrateAuthorInfo([userId]);
  return ((rows ?? []) as YimPostRow[]).map((r) => mapRowToPost(r, signedUrlMap, authorInfoMap));
}

export function useYimFeed(showAllPosts: boolean = false) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHardRefreshing, setIsHardRefreshing] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const [nowTick, setNowTick] = useState(() => Date.now());

  const cycleDateKey = useMemo(() => getPacificIsoDateForCycleStart(new Date(nowTick), 6), [nowTick]);
  const yesterdayDateKey = useMemo(() => addDaysToIsoDate(cycleDateKey, -1), [cycleDateKey]);

  // Keep cycle date rolling at 6AM.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);


  const feedQ = useQuery({
    queryKey: userId 
      ? (showAllPosts ? allPostsFeedQueryKey(userId) : yimFeedQueryKey(userId, yesterdayDateKey))
      : ["yimFeed", "anonymous"],
    queryFn: () => showAllPosts 
      ? fetchAllPosts(userId as string) 
      : fetchYimFeed(userId as string, yesterdayDateKey),
    enabled: !!userId,
  });

  const pendingQ = useQuery({
    queryKey: userId ? pendingPostQueryKey(userId, cycleDateKey) : ["pendingPost", "anonymous"],
    queryFn: () => fetchPendingPost(userId as string, cycleDateKey),
    enabled: !!userId,
  });

  // Check if user has a post for yesterday (viewing day response)
  const viewingDayPostQ = useQuery({
    queryKey: userId ? pendingPostQueryKey(userId, yesterdayDateKey) : ["viewingDayPost", "anonymous"],
    queryFn: () => fetchPendingPost(userId as string, yesterdayDateKey),
    enabled: !!userId,
  });

  const refetch = useCallback(
    async (forceRefresh = false) => {
      if (!userId) return;
      if (!forceRefresh) setIsRefreshing(true);
      else setIsHardRefreshing(true);
      try {
        await Promise.allSettled([feedQ.refetch(), pendingQ.refetch(), viewingDayPostQ.refetch()]);
      } finally {
        setIsRefreshing(false);
        setIsHardRefreshing(false);
      }
    },
    [feedQ, pendingQ, viewingDayPostQ, userId]
  );

  const addPostOptimistically = useCallback(
    (post: Post) => {
      if (!userId) return;
      const postPromptDate = post.promptDate;
      if (postPromptDate && postPromptDate === cycleDateKey) {
        queryClient.setQueryData<Post | null>(pendingPostQueryKey(userId, cycleDateKey), () => post);
        return;
      }
      if (postPromptDate && postPromptDate === yesterdayDateKey) {
        queryClient.setQueryData<Post[]>(yimFeedQueryKey(userId, yesterdayDateKey), (prev) => [post, ...(prev ?? [])]);
        // Also update the viewing day post cache
        queryClient.setQueryData<Post | null>(pendingPostQueryKey(userId, yesterdayDateKey), () => post);
      }
    },
    [cycleDateKey, queryClient, userId, yesterdayDateKey]
  );

  return useMemo(() => {
    const errorMessage =
      (feedQ.error instanceof Error ? feedQ.error.message : feedQ.error ? String(feedQ.error) : null) ??
      (pendingQ.error instanceof Error ? pendingQ.error.message : pendingQ.error ? String(pendingQ.error) : null) ??
      (viewingDayPostQ.error instanceof Error ? viewingDayPostQ.error.message : viewingDayPostQ.error ? String(viewingDayPostQ.error) : null);
    return {
      cycleDateKey,
      yesterdayDateKey,
      posts: feedQ.data ?? [],
      yesterdayPosts: feedQ.data ?? [],
      pendingPost: pendingQ.data ?? null,
      viewingDayPost: viewingDayPostQ.data ?? null,
      hasRespondedToViewingDay: !!viewingDayPostQ.data,
      isLoading: feedQ.isLoading || pendingQ.isLoading || viewingDayPostQ.isLoading || isHardRefreshing,
      errorMessage,
      isRefreshing,
      refetch,
      addPostOptimistically,
    };
  }, [
    addPostOptimistically,
    cycleDateKey,
    feedQ.data,
    feedQ.error,
    feedQ.isLoading,
    isHardRefreshing,
    isRefreshing,
    pendingQ.data,
    pendingQ.error,
    pendingQ.isLoading,
    viewingDayPostQ.data,
    viewingDayPostQ.error,
    viewingDayPostQ.isLoading,
    refetch,
    yesterdayDateKey,
  ]);
}

export function useUserPosts() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const q = useQuery({
    queryKey: userId ? userPostsQueryKey(userId) : ["userPosts", "anonymous"],
    queryFn: () => fetchUserPosts(userId as string),
    enabled: !!userId,
  });

  const refetch = useCallback(async () => {
    await q.refetch();
  }, [q]);

  return {
    posts: q.data ?? [],
    isLoading: q.isLoading,
    errorMessage: q.error instanceof Error ? q.error.message : q.error ? String(q.error) : null,
    refetch,
  };
}






