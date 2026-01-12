import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { useEventTracking } from "@/hooks/useEventTracking";
import { supabase } from "@/lib/supabase";
import { getTodayPacificIsoDate } from "@/lib/timezone";
import { useAuth } from "@/providers/auth-provider";

export function DailyFeedback() {
  const { user } = useAuth();
  const { trackEvent } = useEventTracking();

  const feedbackDate = useMemo(() => getTodayPacificIsoDate(), []);

  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submit() {
    if (!user) return;
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStatus(null);
    try {
      const responses = {
        notes: notes.trim(),
        rating,
        feedbackDate,
      };

      const { error } = await supabase.from("user_feedback").insert({
        user_id: user.id,
        feedback_date: feedbackDate,
        rating,
        responses,
      });

      if (error) throw error;

      await trackEvent({
        event_type: "feedback_submit",
        event_name: "daily_feedback_submit",
        metadata: { feedback_date: feedbackDate, rating },
      });

      setStatus("Thanks — feedback saved.");
    } catch (error) {
      console.warn("[DailyFeedback] submit failed", error);
      setStatus(error instanceof Error ? error.message : "Failed to submit feedback.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View className="rounded-2xl border border-muted bg-card p-4">
      <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Daily feedback</Text>
      <Text className="mt-2 font-body text-sm text-foreground">
        Quick pulse check for alpha testing. (Date: {feedbackDate})
      </Text>

      <View className="mt-4">
        <Text className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Rating (1–5)</Text>
        <View className="mt-2 flex-row gap-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = rating === n;
            return (
              <Pressable
                key={n}
                onPress={() => setRating(n)}
                accessibilityRole="button"
                className={[
                  "h-10 w-10 items-center justify-center rounded-xl border",
                  active ? "border-primary bg-primary/15" : "border-muted bg-background",
                ].join(" ")}
              >
                <Text className={active ? "font-mono text-sm text-primary" : "font-mono text-sm text-foreground"}>
                  {n}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="mt-4">
        <Text className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="What felt good/bad today? Any bugs?"
          placeholderTextColor="hsl(0 0% 55%)"
          multiline
          className="mt-2 min-h-[96px] rounded-xl border border-muted bg-background px-3 py-3 font-body text-sm text-foreground"
        />
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <Pressable
          onPress={() => void submit()}
          disabled={!user || isSubmitting}
          accessibilityRole="button"
          className={[
            "items-center justify-center rounded-xl px-4 py-3",
            !user || isSubmitting ? "bg-muted" : "bg-primary",
          ].join(" ")}
        >
          {isSubmitting ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator />
              <Text className="font-mono text-xs uppercase tracking-wider text-foreground">Saving…</Text>
            </View>
          ) : (
            <Text className="font-mono text-xs uppercase tracking-wider text-background">Submit</Text>
          )}
        </Pressable>

        {!!status ? <Text className="ml-4 flex-1 text-right font-mono text-xs text-muted-foreground">{status}</Text> : null}
      </View>
    </View>
  );
}





