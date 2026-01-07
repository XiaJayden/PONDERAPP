import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAuth } from "@/providers/auth-provider";

type AuthMode = "login" | "register";

export default function LoginScreen() {
  const { signIn, signUp, signInWithGoogle, isLoading, errorMessage } = useAuth();

  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = useMemo(() => (authMode === "login" ? "Login to post" : "Create an account"), [authMode]);
  const toggleLabel = useMemo(
    () => (authMode === "login" ? "Create an account" : "Have an account?"),
    [authMode]
  );

  async function handleSubmit() {
    if (!email.trim() || !password) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (__DEV__) console.log("[login] submit", { mode: authMode, email: email.trim() });
      if (authMode === "login") await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
      setPassword("");
      // Navigation happens via auth guards (tabs layout).
    } catch (error) {
      console.warn("[login] submit failed", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogle() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (__DEV__) console.log("[login] google");
      await signInWithGoogle();
    } catch (error) {
      console.warn("[login] google failed", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      <View className="flex-1 px-4 justify-between">
        <View className="flex-1" />
        
        <View className="items-center">
          <Image
            source={require("../../assets/images/ponder logo.png")}
            accessibilityLabel="ponder"
            style={{ width: 280, height: 112, resizeMode: "contain" }}
          />
        </View>

        <View className="rounded-2xl border border-muted bg-card p-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{title}</Text>
            <Pressable
              onPress={() => setAuthMode((m) => (m === "login" ? "register" : "login"))}
              accessibilityRole="button"
            >
              <Text className="font-mono text-xs text-primary">{toggleLabel}</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => void handleGoogle()}
            disabled={isSubmitting || isLoading}
            className="w-full flex-row items-center justify-center gap-2 rounded-xl border border-muted bg-background px-4 py-3"
          >
            <Text className="font-mono text-sm text-foreground">
              {isSubmitting ? "Working..." : "Continue with Google"}
            </Text>
            {!isSubmitting && (
              <MaterialCommunityIcons name="google" size={18} color="hsl(60 9% 98%)" />
            )}
          </Pressable>

          <View className="my-4 flex-row items-center">
            <View className="h-px flex-1 bg-muted" />
            <Text className="mx-3 font-mono text-xs text-muted-foreground">OR</Text>
            <View className="h-px flex-1 bg-muted" />
          </View>

          <View className="gap-3">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="hsl(0 0% 55%)"
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              className="rounded-xl border border-muted bg-background px-4 py-3 font-body text-base text-foreground"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="hsl(0 0% 55%)"
              secureTextEntry
              textContentType="password"
              className="rounded-xl border border-muted bg-background px-4 py-3 font-body text-base text-foreground"
            />

            {!!errorMessage && <Text className="font-mono text-xs text-destructive">{errorMessage}</Text>}

            <Pressable
              onPress={() => void handleSubmit()}
              disabled={isSubmitting || isLoading}
              className="w-full items-center justify-center rounded-xl bg-primary px-4 py-3"
            >
              {isSubmitting ? (
                <ActivityIndicator />
              ) : (
                <Text className="font-mono text-xs uppercase tracking-wider text-background">
                  {authMode === "login" ? "Login" : "Register"}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                if (__DEV__) console.log("[login] dev → onboarding");
                router.push("/(auth)/onboarding");
              }}
              className="items-center py-2"
            >
              <Text className="font-mono text-xs text-muted-foreground">Dev: go to onboarding</Text>
            </Pressable>
          </View>
        </View>
        
        <View className="flex-1" />
      </View>
    </KeyboardAvoidingView>
  );
}


