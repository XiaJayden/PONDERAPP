/**
 * Supabase Edge Function: Send Push Notifications
 * 
 * Handles scheduled push notifications for posting/viewing phases.
 * Called by pg_cron jobs at 6AM and 6PM PST.
 * 
 * Query params:
 * - trigger_time: "6am" or "6pm"
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";
const PACIFIC_TZ = "America/Los_Angeles";
const PHASE_ANCHOR_UTC = new Date("2026-01-13T14:00:00.000Z"); // 6AM PST on Jan 13, 2026
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface NotificationConfig {
  title: string;
  body: string;
}

const NOTIFICATION_MESSAGES: Record<string, NotificationConfig> = {
  posting_open: {
    title: "New PONDER",
    body: "Today's reflection question is ready. Take a moment to share your thoughts.",
  },
  posting_reminder: {
    title: "Don't forget to PONDER",
    body: "The posting window closes soon. Share your reflection before time runs out.",
  },
  viewing_open: {
    title: "Reflections are ready",
    body: "See what your friends shared. The viewing period is now open.",
  },
};

/**
 * Get parts of a date in a specific timezone.
 */
function getPartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type === "literal") continue;
    map[p.type] = p.value;
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/**
 * Convert Pacific wall time to UTC Date.
 * Simplified version of the mobile app's pacificWallTimeToUtc function.
 */
function pacificWallTimeToUtc(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}) {
  const desired = {
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute,
    second: 0,
  };

  // Initial naive guess
  let utcMs = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second
  );

  // Correction pass for DST
  for (let i = 0; i < 2; i += 1) {
    const guess = new Date(utcMs);
    const actualLocal = getPartsInTimeZone(guess, PACIFIC_TZ);

    const desiredTod = desired.hour * 60 * 60 * 1000 + desired.minute * 60 * 1000;
    const actualTod = actualLocal.hour * 60 * 60 * 1000 + actualLocal.minute * 60 * 1000;
    const deltaMs = desiredTod - actualTod;

    const desiredDateKey = `${desired.year}-${String(desired.month).padStart(2, "0")}-${String(desired.day).padStart(2, "0")}`;
    const actualDateKey = `${actualLocal.year}-${String(actualLocal.month).padStart(2, "0")}-${String(actualLocal.day).padStart(2, "0")}`;

    if (desiredDateKey !== actualDateKey) {
      const desiredUtcMidnight = Date.UTC(desired.year, desired.month - 1, desired.day, 0, 0, 0);
      const actualUtcMidnight = Date.UTC(
        actualLocal.year,
        actualLocal.month - 1,
        actualLocal.day,
        0,
        0,
        0
      );
      const dayDelta = desiredUtcMidnight - actualUtcMidnight;
      utcMs += dayDelta;
    }

    utcMs += deltaMs;
  }

  return new Date(utcMs);
}

/**
 * Get the current phase (posting or viewing) based on the anchor date.
 * Replicates the logic from lib/phase.ts.
 */
function getCurrentPhase(now: Date = new Date()): "posting" | "viewing" {
  const nowPacific = getPartsInTimeZone(now, PACIFIC_TZ);

  // Find the most recent 6AM PT boundary
  const today6am = pacificWallTimeToUtc({
    year: nowPacific.year,
    month: nowPacific.month,
    day: nowPacific.day,
    hour: 6,
    minute: 0,
  });

  // If it's before 6AM today, use yesterday's 6AM
  const lastFlip =
    now.getTime() < today6am.getTime()
      ? pacificWallTimeToUtc({
          year: nowPacific.year,
          month: nowPacific.month,
          day: nowPacific.day - 1,
          hour: 6,
          minute: 0,
        })
      : today6am;

  // Count days since anchor (at 6AM boundaries)
  const daysSinceAnchor = Math.floor(
    (lastFlip.getTime() - PHASE_ANCHOR_UTC.getTime()) / MS_PER_DAY
  );

  // Even days = posting, odd days = viewing
  return daysSinceAnchor % 2 === 0 ? "posting" : "viewing";
}

/**
 * Get today's prompt date (cycle date) in Pacific timezone.
 * Returns YYYY-MM-DD string.
 */
function getTodayPacificIsoDate(now: Date = new Date()): string {
  const parts = getPartsInTimeZone(now, PACIFIC_TZ);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/**
 * Get the cycle date for a 6AM→6AM Pacific cycle.
 */
function getPacificIsoDateForCycleStart(now: Date = new Date()): string {
  const pacificToday = getTodayPacificIsoDate(now);
  const parts = getPartsInTimeZone(now, PACIFIC_TZ);
  if (parts.hour < 6) {
    // Before 6AM, use yesterday's date
    const yesterday = new Date(now.getTime() - MS_PER_DAY);
    return getTodayPacificIsoDate(yesterday);
  }
  return pacificToday;
}

/**
 * Determine notification type based on trigger time and current phase.
 */
function getNotificationType(
  triggerTime: "6am" | "6pm"
): "posting_open" | "posting_reminder" | "viewing_open" | null {
  const phase = getCurrentPhase();

  if (triggerTime === "6am") {
    return phase === "posting" ? "posting_open" : "viewing_open";
  }

  if (triggerTime === "6pm") {
    return phase === "posting" ? "posting_reminder" : null; // No 6pm notification on viewing days
  }

  return null;
}

/**
 * Send push notifications via Expo Push API.
 * Batches tokens (max 100 per request).
 */
async function sendPushNotifications(
  tokens: string[],
  notification: NotificationConfig
): Promise<void> {
  // Expo Push API accepts up to 100 tokens per request
  const BATCH_SIZE = 100;

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const messages = batch.map((token) => ({
      to: token,
      sound: "default",
      title: notification.title,
      body: notification.body,
      data: { notificationType: notification.title.toLowerCase().replace(/\s+/g, "_") },
    }));

    try {
      const response = await fetch(EXPO_PUSH_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[send-notifications] Expo API error: ${response.status} ${errorText}`);
        throw new Error(`Expo Push API error: ${response.status}`);
      }

      const result = await response.json();
      console.log(`[send-notifications] Sent batch ${i / BATCH_SIZE + 1}, tokens: ${batch.length}`);
      
      // Log any errors from Expo
      if (result.data) {
        const errors = result.data.filter((r: any) => r.status === "error");
        if (errors.length > 0) {
          console.warn(`[send-notifications] ${errors.length} tokens failed:`, errors);
        }
      }
    } catch (error) {
      console.error(`[send-notifications] Failed to send batch ${i / BATCH_SIZE + 1}:`, error);
      throw error;
    }
  }
}

serve(async (req) => {
  try {
    // Get trigger_time from query params
    const url = new URL(req.url);
    const triggerTime = url.searchParams.get("trigger_time") as "6am" | "6pm" | null;

    if (!triggerTime || (triggerTime !== "6am" && triggerTime !== "6pm")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid trigger_time parameter (must be '6am' or '6pm')" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Determine notification type based on phase
    const notificationType = getNotificationType(triggerTime);
    if (!notificationType) {
      console.log(`[send-notifications] No notification needed for ${triggerTime} (current phase: ${getCurrentPhase()})`);
      return new Response(
        JSON.stringify({ message: "No notification needed for this phase/time combination" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const notification = NOTIFICATION_MESSAGES[notificationType];
    if (!notification) {
      throw new Error(`Unknown notification type: ${notificationType}`);
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get push tokens
    let tokensQuery = supabase.from("push_tokens").select("user_id, expo_push_token");

    // For posting_reminder, only send to users who haven't posted yet
    if (notificationType === "posting_reminder") {
      const cycleDateKey = getPacificIsoDateForCycleStart();
      
      // Get today's prompt ID
      const { data: prompt } = await supabase
        .from("daily_prompts")
        .select("id")
        .eq("prompt_date", cycleDateKey)
        .limit(1)
        .maybeSingle();

      if (!prompt) {
        console.log(`[send-notifications] No prompt found for date ${cycleDateKey}, skipping reminder`);
        return new Response(
          JSON.stringify({ message: "No prompt found for today, skipping reminder" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Get users who have posted
      const { data: usersWhoPosted } = await supabase
        .from("yim_posts")
        .select("author_id")
        .eq("prompt_id", prompt.id);

      const postedUserIds = new Set((usersWhoPosted || []).map((p) => p.author_id));

      // Fetch all tokens first, then filter out users who posted
      const { data: allTokens, error: tokensError } = await tokensQuery;
      
      if (tokensError) {
        console.error("[send-notifications] Failed to fetch push tokens:", tokensError);
        throw tokensError;
      }

      // Filter out users who have already posted
      const tokens = (allTokens || []).filter((t) => !postedUserIds.has(t.user_id));
      
      if (tokens.length === 0) {
        console.log("[send-notifications] No push tokens found (all users have posted)");
        return new Response(
          JSON.stringify({ message: "No push tokens found (all users have posted)" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      const expoPushTokens = tokens.map((t) => t.expo_push_token).filter(Boolean);

      // Send notifications
      await sendPushNotifications(expoPushTokens, notification);

      return new Response(
        JSON.stringify({
          success: true,
          notificationType,
          tokensSent: expoPushTokens.length,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // For non-reminder notifications, get all tokens
    const { data: tokens, error: tokensError } = await tokensQuery;

    if (tokensError) {
      console.error("[send-notifications] Failed to fetch push tokens:", tokensError);
      throw tokensError;
    }

    if (!tokens || tokens.length === 0) {
      console.log("[send-notifications] No push tokens found");
      return new Response(
        JSON.stringify({ message: "No push tokens found" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const expoPushTokens = tokens.map((t) => t.expo_push_token).filter(Boolean);

    // Send notifications
    await sendPushNotifications(expoPushTokens, notification);

    return new Response(
      JSON.stringify({
        success: true,
        notificationType,
        tokensSent: expoPushTokens.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-notifications] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
