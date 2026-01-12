import { useEffect, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getPacificIsoDateForCycleStart, getTodayPacificIsoDate } from "@/lib/timezone";
import { clearDevHasRespondedOverride, getDevHasRespondedOverride } from "@/lib/prompt-store";
import { useAuth } from "@/providers/auth-provider";


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

  // Actions
  refetch: () => Promise<void>;
}

type DevPromptOverride = {
  force_open: boolean;
  force_closed: boolean;
  expires_at: string | null;
  created_at: string;
} | null;


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

async function fetchLatestPrompt(): Promise<DailyPrompt | null> {
  const { data, error } = await supabase
    .from("daily_prompts")
    .select("*")
    .order("prompt_date", { ascending: false })
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
  const prevPromptIdRef = useRef<string | null>(null);
  const userId = user?.id ?? null;

  const cycleDateKey = useMemo(() => getPacificIsoDateForCycleStart(new Date(), 6), []);

  const promptQ = useQuery({
    queryKey: dailyPromptForDateQueryKey(cycleDateKey),
    queryFn: async () => {
      const p = await fetchPromptForDate(cycleDateKey);
      // Dev ergonomics: if today's cycle prompt isn't seeded yet, fall back to the latest prompt
      // so Reset Cycle → Respond can still be tested end-to-end.
      if (!p && __DEV__) return fetchLatestPrompt();
      return p;
    },
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
    });
  }

  return {
    prompt,
    isLoading,
    errorMessage,
    cycleDateKey,
    hasAnsweredToday: effectiveHasResponded,
    hasResponded: effectiveHasResponded,
    refetch,
  };
}






