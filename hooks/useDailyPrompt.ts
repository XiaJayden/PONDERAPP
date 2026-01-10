import { useEffect, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getPacificIsoDateForCycleStart, getPacificTimeForPromptDate, getTodayPacificIsoDate } from "@/lib/timezone";
import { getDevHasRespondedOverride, getUserPromptOpenTime, setUserPromptOpenTime } from "@/lib/prompt-store";
import { useAuth } from "@/providers/auth-provider";

function envFlagEnabled(value: string | undefined) {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * TEMP: disables prompt timing gates.
 *
 * Default behavior:
 * - Enabled in dev (`__DEV__`) for fast iteration/testing.
 * - Can also be enabled explicitly via env var for a TestFlight/preview build.
 *
 * Env:
 * - EXPO_PUBLIC_DISABLE_PROMPT_TIME_RESTRICTIONS=true
 */
const DISABLE_PROMPT_TIME_RESTRICTIONS =
  __DEV__ || envFlagEnabled(process.env.EXPO_PUBLIC_DISABLE_PROMPT_TIME_RESTRICTIONS);

export interface DailyPrompt {
  id: string;
  prompt_text: string;
  explanation_text: string | null;
  prompt_date: string; // YYYY-MM-DD
  theme: string | null;
  display_order: number | null;
}

interface UseDailyPromptResult {
  prompt: DailyPrompt | null;
  isLoading: boolean;
  errorMessage: string | null;

  // Single-login daily cycle (6AM→6AM Pacific)
  cycleDateKey: string; // YYYY-MM-DD
  hasAnsweredToday: boolean;

  // Back-compat aliases used throughout the app
  hasResponded: boolean;
  isPromptAvailable: boolean; // during the cycle
  isResponseWindowOpen: boolean; // before next 6am PT
  isInResponseWindow: boolean; // after user opened prompt AND before their deadline

  timeUntilDeadline: number | null; // ms
  timeUntilCycleEnd: number | null; // ms (until next 6:00am PT)

  // Legacy (no longer used by the single-login cycle)
  timeUntilRelease: number | null;

  // Actions
  markPromptOpened: () => Promise<void>;
  refetch: () => Promise<void>;
}

type DevPromptOverride = {
  force_open: boolean;
  force_closed: boolean;
  expires_at: string | null;
  created_at: string;
} | null;

function getPromptAvailableTime(promptDate: string) {
  return getPacificTimeForPromptDate(promptDate, 6, 0);
}

function addDaysToIsoDate(isoDate: string, deltaDays: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`[useDailyPrompt] Invalid ISO date: ${isoDate}`);
  const [, y, m, d] = match;
  const ms = Date.UTC(Number(y), Number(m) - 1, Number(d) + deltaDays, 12, 0, 0);
  const dd = new Date(ms);
  const yy = dd.getUTCFullYear();
  const mm = String(dd.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dd.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${day}`;
}

function isAfterOrEqual(a: Date, b: Date) {
  return a.getTime() >= b.getTime();
}

function isBefore(a: Date, b: Date) {
  return a.getTime() < b.getTime();
}

function getTimeUntil(target: Date, now: Date) {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return null;
  return diff;
}

async function didUserRespondToPrompt(params: { userId: string; promptId: string }) {
  const { data, error } = await supabase
    .from("yim_posts")
    .select("id")
    .eq("author_id", params.userId)
    .eq("prompt_id", params.promptId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[useDailyPrompt] didUserRespondToPrompt failed", error);
    return false;
  }

  return !!data;
}

export function dailyPromptQueryKey() {
  return ["dailyPrompt", "current"] as const;
}

export function dailyPromptForDateQueryKey(promptDate: string) {
  return ["dailyPrompt", "date", promptDate] as const;
}

export async function fetchPromptForDate(promptDate: string): Promise<DailyPrompt | null> {
  const { data, error } = await supabase
    .from("daily_prompts")
    .select("*")
    .eq("prompt_date", promptDate)
    .limit(1)
    .maybeSingle();

  if (error) {
    if ((error as any).code === "PGRST116") return null;
    throw error;
  }
  if (!data) return null;

  return {
    id: String((data as any).id),
    prompt_text: String((data as any).prompt_text),
    explanation_text: (data as any).explanation_text ? String((data as any).explanation_text) : null,
    prompt_date: String((data as any).prompt_date),
    theme: (data as any).theme ? String((data as any).theme) : null,
    display_order: (data as any).display_order ?? null,
  };
}

export async function fetchCurrentPrompt(now: Date = new Date()): Promise<DailyPrompt | null> {
  const cycleDateKey = getPacificIsoDateForCycleStart(now, 6);
  return fetchPromptForDate(cycleDateKey);
}

export function devPromptOverrideQueryKey(userId: string) {
  return ["devPromptOverride", userId] as const;
}

export async function fetchDevPromptOverride(userId: string): Promise<DevPromptOverride> {
  // Best-effort; if table/policy doesn't exist, ignore.
  const { data: overrideData, error: overrideError } = await supabase
    .from("dev_prompt_overrides")
    .select("force_open,force_closed,expires_at,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (overrideError) {
    if (__DEV__) console.warn("[useDailyPrompt] dev override fetch failed", overrideError);
    return null;
  }

  if (!overrideData) return null;
  return {
    force_open: !!(overrideData as any).force_open,
    force_closed: !!(overrideData as any).force_closed,
    expires_at: (overrideData as any).expires_at ?? null,
    created_at: String((overrideData as any).created_at),
  };
}

export function didRespondQueryKey(userId: string, promptId: string) {
  return ["didRespondToPrompt", userId, promptId] as const;
}

export async function fetchDidUserRespondToPrompt(params: { userId: string; promptId: string }) {
  return didUserRespondToPrompt(params);
}

export function useDailyPrompt(): UseDailyPromptResult {
  const { user } = useAuth();
  const [timeUntilDeadline, setTimeUntilDeadline] = useState<number | null>(null);
  const [timeUntilCycleEnd, setTimeUntilCycleEnd] = useState<number | null>(null);
  const prevPromptIdRef = useRef<string | null>(null);
  const userId = user?.id ?? null;

  // Lightweight "now tick" so cycle rolls at 6AM without requiring other state changes.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const cycleDateKey = useMemo(() => getPacificIsoDateForCycleStart(new Date(nowTick), 6), [nowTick]);

  const promptQ = useQuery({
    queryKey: dailyPromptForDateQueryKey(cycleDateKey),
    queryFn: () => fetchPromptForDate(cycleDateKey),
  });

  const prompt = promptQ.data ?? null;

  const respondedQ = useQuery({
    queryKey: userId && prompt?.id ? didRespondQueryKey(userId, prompt.id) : ["didRespondToPrompt", "disabled"],
    queryFn: () => fetchDidUserRespondToPrompt({ userId: userId as string, promptId: (prompt as DailyPrompt).id }),
    enabled: !!userId && !!prompt?.id,
  });

  const overrideQ = useQuery({
    queryKey: userId ? devPromptOverrideQueryKey(userId) : ["devPromptOverride", "disabled"],
    queryFn: () => fetchDevPromptOverride(userId as string),
    enabled: !!userId,
  });

  const hasResponded = respondedQ.data ?? false;
  const devOverride = overrideQ.data ?? null;

  const devRespondedOverrideQ = useQuery({
    queryKey:
      __DEV__ && userId && prompt?.id
        ? ["devHasRespondedOverride", userId, prompt.id, prompt.prompt_date]
        : ["devHasRespondedOverride", "disabled"],
    queryFn: () =>
      getDevHasRespondedOverride({
        userId: userId as string,
        promptId: (prompt as DailyPrompt).id,
        promptDate: (prompt as DailyPrompt).prompt_date,
      }),
    enabled: __DEV__ && !!userId && !!prompt?.id,
  });

  const devHasRespondedOverride = devRespondedOverrideQ.data ?? null;
  const effectiveHasResponded = devHasRespondedOverride !== null ? devHasRespondedOverride : hasResponded;

  const isLoading = promptQ.isLoading || overrideQ.isLoading || respondedQ.isLoading || devRespondedOverrideQ.isLoading;
  const errorMessage =
    (promptQ.error instanceof Error ? promptQ.error.message : promptQ.error ? String(promptQ.error) : null) ??
    (overrideQ.error instanceof Error ? overrideQ.error.message : overrideQ.error ? String(overrideQ.error) : null) ??
    (respondedQ.error instanceof Error ? respondedQ.error.message : respondedQ.error ? String(respondedQ.error) : null) ??
    (devRespondedOverrideQ.error instanceof Error
      ? devRespondedOverrideQ.error.message
      : devRespondedOverrideQ.error
        ? String(devRespondedOverrideQ.error)
        : null);

  async function refetch() {
    const tasks: Promise<unknown>[] = [promptQ.refetch()];
    if (userId) tasks.push(overrideQ.refetch());
    if (userId && prompt?.id) tasks.push(respondedQ.refetch());
    if (__DEV__ && userId && prompt?.id) tasks.push(devRespondedOverrideQ.refetch());
    await Promise.allSettled(tasks);
  }

  async function markPromptOpened() {
    if (!user || !prompt) return;
    await setUserPromptOpenTime({ userId: user.id, promptId: prompt.id, promptDate: prompt.prompt_date });
  }

  // Update timers every second (simple + debug friendly).
  useEffect(() => {
    if (!prompt) return;

    let isCancelled = false;

    async function tick() {
      if (isCancelled) return;
      const now = new Date();

      if (DISABLE_PROMPT_TIME_RESTRICTIONS) {
        // While testing, treat the prompt as always open.
        setTimeUntilDeadline(null);
        setTimeUntilCycleEnd(null);
        return;
      }

      const isDevOverrideActive =
        !!devOverride &&
        (devOverride.expires_at === null || new Date(devOverride.expires_at).getTime() > now.getTime()) &&
        (devOverride.force_open || devOverride.force_closed);

      const availableAt = getPromptAvailableTime(prompt.prompt_date);
      const nextCycleDateKey = addDaysToIsoDate(prompt.prompt_date, 1);
      const cycleEndsAt = getPromptAvailableTime(nextCycleDateKey); // next day at 6:00am PT

      // Deadline depends on user prompt open time.
      if (!user) {
        setTimeUntilDeadline(null);
      } else {
        if (isDevOverrideActive && devOverride?.force_closed) {
          setTimeUntilDeadline(null);
        } else if (isDevOverrideActive && devOverride?.force_open) {
          // For dev testing, treat deadline as 15 minutes from now.
          setTimeUntilDeadline(15 * 60 * 1000);
        } else {
        const openTime = await getUserPromptOpenTime({
          userId: user.id,
          promptId: prompt.id,
          promptDate: prompt.prompt_date,
        });

        if (!openTime) {
          setTimeUntilDeadline(null);
        } else {
          const userFifteenMinDeadline = new Date(openTime.getTime() + 15 * 60 * 1000);
          const deadline = userFifteenMinDeadline.getTime() < cycleEndsAt.getTime() ? userFifteenMinDeadline : cycleEndsAt;
          const untilDeadline = getTimeUntil(deadline, now);
          setTimeUntilDeadline(untilDeadline);
        }
        }
      }

      setTimeUntilCycleEnd(getTimeUntil(cycleEndsAt, now));

      if (__DEV__) {
        // This can be chatty, so only log occasionally.
      }
    }

    void tick();
    const id = setInterval(() => void tick(), 1000);
    return () => {
      isCancelled = true;
      clearInterval(id);
    };
  }, [prompt?.id, prompt?.prompt_date, user?.id, devOverride]);

  const computed = useMemo(() => {
    const now = new Date();
    if (!prompt) {
      return {
        isPromptAvailable: false,
        isResponseWindowOpen: false,
        isInResponseWindow: false,
      };
    }

    if (DISABLE_PROMPT_TIME_RESTRICTIONS) {
      return { isPromptAvailable: true, isResponseWindowOpen: true, isInResponseWindow: !!user };
    }

    const isDevOverrideActive =
      !!devOverride &&
      (devOverride.expires_at === null || new Date(devOverride.expires_at).getTime() > now.getTime()) &&
      (devOverride.force_open || devOverride.force_closed);

    const availableAt = getPromptAvailableTime(prompt.prompt_date);
    const nextCycleDateKey = addDaysToIsoDate(prompt.prompt_date, 1);
    const cycleEndsAt = getPromptAvailableTime(nextCycleDateKey);

    const isPromptAvailable = isAfterOrEqual(now, availableAt);
    const isResponseWindowOpen = isBefore(now, cycleEndsAt);

    // Being “in” response window requires that user opened prompt and a deadline exists.
    const baseIsInWindow = !!user && isPromptAvailable && isResponseWindowOpen && timeUntilDeadline !== null;

    if (isDevOverrideActive && devOverride?.force_closed) {
      return { isPromptAvailable, isResponseWindowOpen: false, isInResponseWindow: false };
    }

    if (isDevOverrideActive && devOverride?.force_open) {
      // Force open for testing (even if outside normal window).
      return { isPromptAvailable: true, isResponseWindowOpen: true, isInResponseWindow: !!user };
    }

    return { isPromptAvailable, isResponseWindowOpen, isInResponseWindow: baseIsInWindow };
  }, [prompt, timeUntilDeadline, user, devOverride]);

  // Date key for "popup shown today" flags.
  const todayPacific = useMemo(() => getTodayPacificIsoDate(), []);

  // Only log when promptId actually changes (not on every render/timer update).
  if (__DEV__ && prompt && user && prompt.id !== prevPromptIdRef.current) {
    prevPromptIdRef.current = prompt.id;
    // eslint-disable-next-line no-console
    console.log("[useDailyPrompt] prompt changed", {
      promptId: prompt.id,
      promptDate: prompt.prompt_date,
      todayPacific,
      hasResponded: effectiveHasResponded,
      devOverride,
      ...computed,
    });
  }

  return {
    prompt,
    isLoading,
    errorMessage,
    cycleDateKey,
    hasAnsweredToday: effectiveHasResponded,
    hasResponded: effectiveHasResponded,
    timeUntilDeadline,
    timeUntilCycleEnd,
    timeUntilRelease: null,
    ...computed,
    markPromptOpened,
    refetch,
  };
}






