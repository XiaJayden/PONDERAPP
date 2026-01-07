import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";
import { getPacificTimeForPromptDate, getTodayPacificIsoDate } from "@/lib/timezone";
import { getUserPromptOpenTime, setUserPromptOpenTime } from "@/lib/prompt-store";
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

  hasResponded: boolean;
  isPromptAvailable: boolean; // after 6am PT
  isResponseWindowOpen: boolean; // before 12pm PT
  isInResponseWindow: boolean; // after user opened prompt AND before their deadline

  timeUntilDeadline: number | null; // ms
  timeUntilRelease: number | null; // ms (until 12:30pm PT)

  // Actions
  markPromptOpened: () => Promise<void>;
  refetch: () => Promise<void>;
}

function getPromptAvailableTime(promptDate: string) {
  return getPacificTimeForPromptDate(promptDate, 6, 0);
}

function getResponseWindowCloseTime(promptDate: string) {
  return getPacificTimeForPromptDate(promptDate, 12, 0);
}

function getPostReleaseTime(promptDate: string) {
  return getPacificTimeForPromptDate(promptDate, 12, 30);
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

export function useDailyPrompt(): UseDailyPromptResult {
  const { user } = useAuth();

  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [hasResponded, setHasResponded] = useState(false);
  const [timeUntilDeadline, setTimeUntilDeadline] = useState<number | null>(null);
  const [timeUntilRelease, setTimeUntilRelease] = useState<number | null>(null);

  async function refetch() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Match the web MVP logic: prefer display_order when available, fallback to legacy is_active.
      let { data: promptData, error: promptError } = await supabase
        .from("daily_prompts")
        .select("*")
        .not("display_order", "is", null)
        .order("display_order", { ascending: true })
        .limit(1)
        .single();

      if (promptError && (promptError.message?.includes("display_order") || promptError.code === "42703")) {
        const fallback = await supabase
          .from("daily_prompts")
          .select("*")
          .eq("is_active", true)
          .order("prompt_date", { ascending: false })
          .limit(1)
          .single();
        promptData = fallback.data;
        promptError = fallback.error;
      }

      if (promptError && promptError.code !== "PGRST116") throw promptError;

      if (!promptData) {
        setPrompt(null);
        setHasResponded(false);
        setTimeUntilDeadline(null);
        setTimeUntilRelease(null);
        return;
      }

      const mapped: DailyPrompt = {
        id: String(promptData.id),
        prompt_text: String(promptData.prompt_text),
        explanation_text: promptData.explanation_text ? String(promptData.explanation_text) : null,
        prompt_date: String(promptData.prompt_date),
        theme: promptData.theme ? String(promptData.theme) : null,
        display_order: promptData.display_order ?? null,
      };

      setPrompt(mapped);

      // Responded status
      if (user) setHasResponded(await didUserRespondToPrompt({ userId: user.id, promptId: mapped.id }));
      else setHasResponded(false);

      // Timers are computed in the interval effect below.
    } catch (error) {
      console.error("[useDailyPrompt] refetch failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to fetch daily prompt");
      setPrompt(null);
      setHasResponded(false);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

      const availableAt = getPromptAvailableTime(prompt.prompt_date);
      const closesAt = getResponseWindowCloseTime(prompt.prompt_date);
      const releasesAt = getPostReleaseTime(prompt.prompt_date);

      // Deadline depends on user prompt open time.
      if (!user) {
        setTimeUntilDeadline(null);
      } else {
        const openTime = await getUserPromptOpenTime({
          userId: user.id,
          promptId: prompt.id,
          promptDate: prompt.prompt_date,
        });

        if (!openTime) {
          setTimeUntilDeadline(null);
        } else {
          const userThirtyMinDeadline = new Date(openTime.getTime() + 30 * 60 * 1000);
          const deadline = userThirtyMinDeadline.getTime() < closesAt.getTime() ? userThirtyMinDeadline : closesAt;
          const untilDeadline = getTimeUntil(deadline, now);
          setTimeUntilDeadline(untilDeadline);
        }
      }

      setTimeUntilRelease(getTimeUntil(releasesAt, now));

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
  }, [prompt?.id, prompt?.prompt_date, user?.id]);

  const computed = useMemo(() => {
    const now = new Date();
    if (!prompt) {
      return {
        isPromptAvailable: false,
        isResponseWindowOpen: false,
        isInResponseWindow: false,
      };
    }

    const availableAt = getPromptAvailableTime(prompt.prompt_date);
    const closesAt = getResponseWindowCloseTime(prompt.prompt_date);

    const isPromptAvailable = isAfterOrEqual(now, availableAt);
    const isResponseWindowOpen = isBefore(now, closesAt);

    // Being “in” response window requires that user opened prompt and a deadline exists.
    const isInResponseWindow = !!user && isPromptAvailable && isResponseWindowOpen && timeUntilDeadline !== null;

    return { isPromptAvailable, isResponseWindowOpen, isInResponseWindow };
  }, [prompt, timeUntilDeadline, user]);

  // Date key for “popup shown today” flags.
  const todayPacific = useMemo(() => getTodayPacificIsoDate(), []);

  if (__DEV__ && prompt && user) {
    // One-time-ish log when prompt changes; helps debug timing issues.
    // eslint-disable-next-line no-console
    console.log("[useDailyPrompt] state", {
      promptId: prompt.id,
      promptDate: prompt.prompt_date,
      todayPacific,
      hasResponded,
      ...computed,
    });
  }

  return {
    prompt,
    isLoading,
    errorMessage,
    hasResponded,
    timeUntilDeadline,
    timeUntilRelease,
    ...computed,
    markPromptOpened,
    refetch,
  };
}




