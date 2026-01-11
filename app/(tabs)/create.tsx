import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { CreatePost } from "@/components/posts/create-post";
import { pendingPostQueryKey, fetchPendingPost } from "@/hooks/useYimFeed";
import { useAuth } from "@/providers/auth-provider";
import { getPacificIsoDateForCycleStart } from "@/lib/timezone";
import { useYimFeed } from "@/hooks/useYimFeed";

export default function CreateScreen() {
  const params = useLocalSearchParams<{
    promptId?: string;
    promptText?: string;
    promptDate?: string;
    postId?: string;
    edit?: string;
  }>();

  // #region agent log
  console.log('[DEBUG H3/H4] CreateScreen rendered', { promptId: params.promptId, promptText: params.promptText?.substring(0, 30), promptDate: params.promptDate, hasPromptId: !!params.promptId, hasPromptText: !!params.promptText });
  // #endregion

  const { user } = useAuth();
  const { addPostOptimistically, refetch } = useYimFeed();
  const cycleDateKey = getPacificIsoDateForCycleStart(new Date(), 6);

  const pendingPostQ = useQuery({
    queryKey: user?.id && params.edit === "true" ? pendingPostQueryKey(user.id, cycleDateKey) : ["pendingPost", "disabled"],
    queryFn: () => fetchPendingPost(user!.id, cycleDateKey),
    enabled: !!user?.id && params.edit === "true",
  });

  const pendingPost = pendingPostQ.data ?? null;

  // #region agent log
  console.log('[DEBUG H5] CreateScreen before return', { userId: user?.id?.substring(0, 8), hasUser: !!user, promptId: params.promptId, pendingPost: !!pendingPost });
  // #endregion

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="flex-1">
        <CreatePost
          promptId={params.promptId}
          promptText={params.promptText}
          promptDate={params.promptDate}
          existingPost={params.edit === "true" && params.postId ? pendingPost : undefined}
          onPosted={(created) => {
            // Immediately show the new post in feed, then refetch in background.
            addPostOptimistically(created);
            void refetch(true);
            router.replace("/(tabs)");
          }}
        />
      </View>
    </SafeAreaView>
  );
}


