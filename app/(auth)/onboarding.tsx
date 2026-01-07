import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, Text, TextInput, View } from "react-native";

import { useAuth } from "@/providers/auth-provider";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabase";

type Step = 1 | 2 | 3 | 4;

function isOldEnough(birthday: Date) {
  const now = new Date();
  const age = now.getFullYear() - birthday.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > birthday.getMonth() ||
    (now.getMonth() === birthday.getMonth() && now.getDate() >= birthday.getDate());
  const exactAge = hasHadBirthdayThisYear ? age : age - 1;
  return exactAge >= 13;
}

function formatBirthdayISO(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function OnboardingScreen() {
  const { user } = useAuth();
  const { checkUsernameAvailability, upsertProfile } = useProfile();

  const [step, setStep] = useState<Step>(1);

  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [birthday, setBirthday] = useState<Date>(new Date(2005, 0, 1));

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarStoragePath, setAvatarStoragePath] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const progressLabel = useMemo(() => `${step} / 4`, [step]);

  if (!user) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="font-mono text-sm text-muted-foreground">Please log in first.</Text>
      </View>
    );
  }

  async function nextFromFirstName() {
    if (!firstName.trim()) {
      setErrorMessage("First name is required");
      return;
    }

    setErrorMessage(null);
    setStep(2);
  }

  async function nextFromUsername() {
    const normalized = username.trim().toLowerCase();
    if (!normalized) {
      setErrorMessage("Username is required");
      return;
    }

    if (!/^[a-z0-9_]+$/.test(normalized)) {
      setErrorMessage("Username can only contain letters, numbers, and underscores");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const available = await checkUsernameAvailability(normalized);
      if (!available) {
        setErrorMessage("This username is already taken");
        return;
      }

      setStep(3);
    } catch (error) {
      console.error("[onboarding] username check failed", error);
      setErrorMessage("Failed to check username. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function nextFromBirthday() {
    if (!isOldEnough(birthday)) {
      setErrorMessage("You must be at least 13 years old");
      return;
    }

    setErrorMessage(null);
    setStep(4);
  }

  async function pickAvatar() {
    setErrorMessage(null);
    setIsBusy(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;

      setAvatarUri(uri);
    } catch (error) {
      console.error("[onboarding] pickAvatar failed", error);
      setErrorMessage("Failed to pick image. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function uploadAvatarIfNeeded() {
    if (!avatarUri) return null;

    // Upload cropped (native crop UI) image to Supabase Storage.
    setIsBusy(true);
    try {
      const fileName = `${user.id}/${Date.now()}.jpg`;

      // Expo supports fetching file:// URIs.
      const response = await fetch(avatarUri);
      const arrayBuffer = await response.arrayBuffer();

      const { error } = await supabase.storage.from("profile-pictures").upload(fileName, arrayBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

      if (error) {
        console.error("[onboarding] avatar upload failed", error);
        throw error;
      }

      setAvatarStoragePath(fileName);
      return fileName;
    } finally {
      setIsBusy(false);
    }
  }

  async function submit(onSkipAvatar: boolean) {
    if (isBusy) return;

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const birthdayISO = formatBirthdayISO(birthday);
      const normalizedUsername = username.trim().toLowerCase();

      const uploadedPath = onSkipAvatar ? null : await uploadAvatarIfNeeded();

      await upsertProfile({
        first_name: firstName.trim(),
        username: normalizedUsername,
        birthday: birthdayISO,
        avatar_url: uploadedPath ?? avatarStoragePath ?? null,
        onboarding_complete: true,
      });

      if (__DEV__) console.log("[onboarding] complete → tabs");
      router.replace("/(tabs)");
    } catch (error) {
      console.error("[onboarding] submit failed", error);
      setErrorMessage("Failed to complete onboarding. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <View className="flex-1 bg-background px-4 pt-20">
      <Text className="mb-8 text-center font-mono text-sm text-muted-foreground">{progressLabel}</Text>

      {step === 1 && (
        <View className="mx-auto w-full max-w-md gap-6">
          <Text className="text-center font-display text-4xl text-foreground">What's your first name?</Text>

          <View className="gap-2">
            <TextInput
              value={firstName}
              onChangeText={(t) => {
                setFirstName(t);
                setErrorMessage(null);
              }}
              placeholder="First name"
              placeholderTextColor="hsl(0 0% 55%)"
              className="rounded-xl border border-muted bg-card px-4 py-3 font-mono text-base text-foreground"
            />
            {!!errorMessage && <Text className="font-mono text-xs text-destructive">{errorMessage}</Text>}
          </View>

          <Pressable
            onPress={() => void nextFromFirstName()}
            disabled={isBusy || !firstName.trim()}
            className="w-full items-center justify-center rounded-xl bg-primary px-4 py-3"
          >
            {isBusy ? (
              <ActivityIndicator />
            ) : (
              <Text className="font-mono text-xs uppercase tracking-wider text-background">Next</Text>
            )}
          </Pressable>
        </View>
      )}

      {step === 2 && (
        <View className="mx-auto w-full max-w-md gap-6">
          <Text className="text-center font-display text-4xl text-foreground">Choose a username</Text>

          <View className="gap-2">
            <TextInput
              value={username}
              onChangeText={(t) => {
                setUsername(t);
                setErrorMessage(null);
              }}
              placeholder="username"
              placeholderTextColor="hsl(0 0% 55%)"
              autoCapitalize="none"
              className="rounded-xl border border-muted bg-card px-4 py-3 font-mono text-base text-foreground"
            />
            {!!errorMessage && <Text className="font-mono text-xs text-destructive">{errorMessage}</Text>}
          </View>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setStep(1)}
              className="flex-1 items-center justify-center rounded-xl border border-muted bg-background px-4 py-3"
            >
              <Text className="font-mono text-sm text-foreground">Back</Text>
            </Pressable>

            <Pressable
              onPress={() => void nextFromUsername()}
              disabled={isBusy || !username.trim()}
              className="flex-1 items-center justify-center rounded-xl bg-primary px-4 py-3"
            >
              {isBusy ? (
                <ActivityIndicator />
              ) : (
                <Text className="font-mono text-xs uppercase tracking-wider text-background">Next</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {step === 3 && (
        <View className="mx-auto w-full max-w-md gap-6">
          <Text className="text-center font-display text-4xl text-foreground">When's your birthday?</Text>

          <View className="rounded-2xl border border-muted bg-card p-4">
            <Text className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">Birthday</Text>

            <DateTimePicker
              value={birthday}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, selected) => {
                if (!selected) return;
                setBirthday(selected);
                setErrorMessage(null);
              }}
              themeVariant="dark"
            />
          </View>

          {!!errorMessage && <Text className="text-center font-mono text-xs text-destructive">{errorMessage}</Text>}

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setStep(2)}
              className="flex-1 items-center justify-center rounded-xl border border-muted bg-background px-4 py-3"
            >
              <Text className="font-mono text-sm text-foreground">Back</Text>
            </Pressable>

            <Pressable
              onPress={() => void nextFromBirthday()}
              className="flex-1 items-center justify-center rounded-xl bg-primary px-4 py-3"
            >
              <Text className="font-mono text-xs uppercase tracking-wider text-background">Next</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === 4 && (
        <View className="mx-auto w-full max-w-md gap-6">
          <Text className="text-center font-display text-4xl text-foreground">Add a profile picture</Text>

          <View className="items-center gap-4">
            <View className="h-32 w-32 overflow-hidden rounded-full border-2 border-muted bg-secondary">
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} className="h-full w-full" resizeMode="cover" />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Text className="font-mono text-xs text-muted-foreground">No photo</Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={() => void pickAvatar()}
              disabled={isBusy}
              className="rounded-xl border border-muted bg-background px-6 py-3"
            >
              <Text className="font-mono text-sm text-foreground">{isBusy ? "Working..." : "Choose Photo"}</Text>
            </Pressable>
          </View>

          {!!errorMessage && <Text className="text-center font-mono text-xs text-destructive">{errorMessage}</Text>}

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setStep(3)}
              className="flex-1 items-center justify-center rounded-xl border border-muted bg-background px-4 py-3"
            >
              <Text className="font-mono text-sm text-foreground">Back</Text>
            </Pressable>

            <Pressable
              onPress={() => void submit(true)}
              disabled={isBusy}
              className="flex-1 items-center justify-center rounded-xl border border-muted bg-background px-4 py-3"
            >
              <Text className="font-mono text-sm text-foreground">Skip</Text>
            </Pressable>

            <Pressable
              onPress={() => void submit(false)}
              disabled={isBusy}
              className="flex-1 items-center justify-center rounded-xl bg-primary px-4 py-3"
            >
              {isBusy ? (
                <ActivityIndicator />
              ) : (
                <Text className="font-mono text-xs uppercase tracking-wider text-background">Finish</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}


