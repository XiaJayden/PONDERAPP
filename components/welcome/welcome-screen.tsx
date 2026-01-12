import { ArrowLeft } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

type Page = 1 | 2 | 3 | 4 | 5;

interface WelcomeScreenProps {
  onFinish: () => void;
}

export function WelcomeScreen({ onFinish }: WelcomeScreenProps) {
  const [page, setPage] = useState<Page>(1);

  const progressLabel = useMemo(() => `${page} / 5`, [page]);

  const handleNext = () => {
    if (page < 5) {
      setPage((p) => (p + 1) as Page);
    }
  };

  const handleFinish = () => {
    onFinish();
  };

  return (
    <View className="flex-1 bg-background px-4 pt-20">
      <View className="mb-4 flex-row items-center justify-between">
        {page > 1 && (
          <Pressable
            onPress={() => setPage((p) => (p - 1) as Page)}
            className="rounded-xl p-2"
          >
            <ArrowLeft color="hsl(60 9% 98%)" size={24} />
          </Pressable>
        )}
        <View className="flex-1" />
        <Text className="font-mono text-sm text-muted-foreground">{progressLabel}</Text>
        <View className="flex-1" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {page === 1 && (
          <View className="mx-auto w-full max-w-md gap-6">
            <Text className="text-center font-display text-5xl text-foreground">
              Thank you so, so much for testing out PONDER!
            </Text>
            <Text className="text-center font-mono text-lg leading-7 text-foreground">
              I wanted to create a really cool product to help our generation think deeper about hard questions while
              also fighting "nonchalant culture" and encourage vulnerability among close friends. I doubt this product
              will ever generate a cent of revenue, but I hope to see it grow and have some tangible benefit to the
              world.
            </Text>
          </View>
        )}

        {page === 2 && (
          <View className="mx-auto w-full max-w-md gap-6">
            <Text className="text-center font-display text-5xl text-foreground">To preface—the product is incomplete.</Text>
            <Text className="text-center font-mono text-lg leading-7 text-foreground">
              Despite my efforts to make it as sturdy as possible, it has bugs and may break. If it survives to the end
              of this 8 day testing period, I'll be very very happy.
            </Text>
          </View>
        )}

        {page === 3 && (
          <View className="mx-auto w-full max-w-md gap-6">
            <Text className="text-center font-display text-5xl text-foreground">Every other morning, at 6AM PST</Text>
            <Text className="text-center font-mono text-lg leading-7 text-foreground">
              All users will be able to access the "Ponder of the Day". It's designed to be a hard question and prompt you
              to ponder a little bit :) The answering period will be open for 24 hours and users can create and edit
              their post until 6AM PST, the next day. At this point, every tester who submitted a prompt will be able to
              view every other tester's post.
            </Text>
          </View>
        )}

        {page === 4 && (
          <View className="mx-auto w-full max-w-md gap-6">
            <Text className="text-center font-display text-5xl text-foreground">This test will run for 8 days</Text>
            <Text className="text-center font-mono text-lg leading-7 text-foreground">
              Consisting of 4 prompts. You'll be asked to rate prompts and indicated whether you would feel inclined to
              share the question with a friend. There's also a general feedback form at the bottom of the profile view
              if you feel inclined to leave any feedback at any point. You can also text me directly!
            </Text>
          </View>
        )}

        {page === 5 && (
          <View className="mx-auto w-full max-w-md gap-6">
            <Text className="text-center font-display text-5xl text-foreground">Text me if you have any questions.</Text>
            <Text className="text-center font-mono text-lg leading-7 text-foreground">
              Thank you again!
            </Text>
          </View>
        )}
      </ScrollView>

      <View className="pb-8 pt-4">
        {page < 5 ? (
          <View className="mx-auto w-full max-w-md">
            <Pressable
              onPress={handleNext}
              className="w-full items-center justify-center rounded-xl bg-primary px-4 py-3"
            >
              <Text className="font-mono text-xs uppercase tracking-wider text-background">Next</Text>
            </Pressable>
          </View>
        ) : (
          <View className="mx-auto w-full max-w-md">
            <Pressable
              onPress={handleFinish}
              className="w-full items-center justify-center rounded-xl bg-primary px-4 py-3"
            >
              <Text className="font-mono text-xs uppercase tracking-wider text-background">Finish</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
