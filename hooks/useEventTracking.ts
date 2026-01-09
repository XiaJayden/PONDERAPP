import { useCallback } from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";

export type UserEventType =
  | "button_press"
  | "screen_view"
  | "session_start"
  | "session_end"
  | "feedback_submit"
  | string;

export function useEventTracking() {
  const { user } = useAuth();

  const trackEvent = useCallback(
    async (params: { event_type: UserEventType; event_name: string; metadata?: Record<string, unknown> }) => {
      if (!user) return;
      const { error } = await supabase.from("user_events").insert({
        user_id: user.id,
        event_type: params.event_type,
        event_name: params.event_name,
        metadata: params.metadata ?? {},
      });
      if (error) {
        console.warn("[useEventTracking] trackEvent failed", error);
      }
    },
    [user]
  );

  return { trackEvent };
}



