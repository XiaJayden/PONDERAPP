import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/providers/auth-provider";
import { dailyPromptForDateQueryKey, devPromptOverrideQueryKey, didRespondQueryKey, fetchDevPromptOverride, fetchDidUserRespondToPrompt, fetchPromptForDate } from "@/hooks/useDailyPrompt";
import { fetchFriends, friendsQueryKey } from "@/hooks/useFriends";
import { fetchProfile, profileQueryKey } from "@/hooks/useProfile";
import { fetchPendingPost, fetchUserPosts, fetchYimFeed, pendingPostQueryKey, userPostsQueryKey, yimFeedQueryKey } from "@/hooks/useYimFeed";
import { getPacificIsoDateForCycleStart } from "@/lib/timezone";

function addDaysToIsoDate(isoDate: string, deltaDays: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`[preload] Invalid ISO date: ${isoDate}`);
  const [, y, m, d] = match;
  const ms = Date.UTC(Number(y), Number(m) - 1, Number(d) + deltaDays, 12, 0, 0);
  const dd = new Date(ms);
  const yy = dd.getUTCFullYear();
  const mm = String(dd.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dd.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${day}`;
}

type PreloadContextValue = {
  isPreloading: boolean;
};

const PreloadContext = createContext<PreloadContextValue | null>(null);

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * PreloadProvider
 *
 * Goal: while the LoadingScreen overlay is visible, warm the key tab data so navigation has no lag.
 * Best-effort: stop blocking after a short cap even if some requests fail.
 */
export function PreloadProvider({
  children,
  maxWaitMs = 3000,
}: {
  children: React.ReactNode;
  maxWaitMs?: number;
}) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();

  const [isPreloading, setIsPreloading] = useState(true);
  const startedForUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;

    // No user → nothing to preload.
    if (!user) {
      setIsPreloading(false);
      startedForUserIdRef.current = null;
      return;
    }

    if (startedForUserIdRef.current === user.id) return;
    startedForUserIdRef.current = user.id;

    let cancelled = false;
    setIsPreloading(true);

    const timeoutId = setTimeout(() => {
      if (!cancelled) setIsPreloading(false);
    }, maxWaitMs);

    async function run() {
      try {
        // Step 1: prompt first (so we can preload "responded" status).
        const cycleDateKey = getPacificIsoDateForCycleStart(new Date(), 6);
        await queryClient.prefetchQuery({
          queryKey: dailyPromptForDateQueryKey(cycleDateKey),
          queryFn: () => fetchPromptForDate(cycleDateKey),
        });

        const prompt = queryClient.getQueryData(
          dailyPromptForDateQueryKey(cycleDateKey)
        ) as Awaited<ReturnType<typeof fetchPromptForDate>>;

        // Step 2: parallel prefetches for the main tabs.
        const yesterdayDateKey = addDaysToIsoDate(cycleDateKey, -1);

        const tasks: Promise<unknown>[] = [
          queryClient.prefetchQuery({
            queryKey: profileQueryKey(user.id),
            queryFn: () => fetchProfile(user.id),
          }),
          queryClient.prefetchQuery({
            queryKey: friendsQueryKey(user.id),
            queryFn: () => fetchFriends(user.id),
          }),
          queryClient.prefetchQuery({
            queryKey: userPostsQueryKey(user.id),
            queryFn: () => fetchUserPosts(user.id),
          }),
          queryClient.prefetchQuery({
            queryKey: yimFeedQueryKey(user.id, yesterdayDateKey),
            queryFn: () => fetchYimFeed(user.id, yesterdayDateKey),
          }),
          queryClient.prefetchQuery({
            queryKey: pendingPostQueryKey(user.id, cycleDateKey),
            queryFn: () => fetchPendingPost(user.id, cycleDateKey),
          }),
          queryClient.prefetchQuery({
            queryKey: devPromptOverrideQueryKey(user.id),
            queryFn: () => fetchDevPromptOverride(user.id),
          }),
        ];

        if (prompt?.id) {
          tasks.push(
            queryClient.prefetchQuery({
              queryKey: didRespondQueryKey(user.id, prompt.id),
              queryFn: () => fetchDidUserRespondToPrompt({ userId: user.id, promptId: prompt.id }),
            })
          );
        }

        await Promise.allSettled(tasks);
      } catch (error) {
        if (__DEV__) console.warn("[preload] failed", error);
      } finally {
        // Ensure we don't block longer than maxWaitMs.
        await sleep(0);
        if (!cancelled) setIsPreloading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isAuthLoading, maxWaitMs, queryClient, user]);

  const value = useMemo<PreloadContextValue>(() => ({ isPreloading }), [isPreloading]);
  return <PreloadContext.Provider value={value}>{children}</PreloadContext.Provider>;
}

export function usePreload() {
  const ctx = useContext(PreloadContext);
  if (!ctx) throw new Error("usePreload must be used within PreloadProvider");
  return ctx;
}




