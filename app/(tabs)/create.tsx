import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CreatePost } from "@/components/posts/create-post";
import { useYimFeed } from "@/hooks/useYimFeed";

export default function CreateScreen() {
  const params = useLocalSearchParams<{
    promptId?: string;
    promptText?: string;
    promptDate?: string;
  }>();

  const { addPostOptimistically, refetch } = useYimFeed();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="flex-1">
        <CreatePost
          promptId={params.promptId}
          promptText={params.promptText}
          promptDate={params.promptDate}
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


