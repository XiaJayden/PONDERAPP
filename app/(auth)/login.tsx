import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/providers/auth-provider";

type AuthMode = "login" | "register";

export default function LoginScreen() {
  const { user, signIn, signUp, signInWithGoogle, isLoading, errorMessage, isEmailConfirmed } = useAuth();

  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVerifyEmail, setShowVerifyEmail] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  // If user exists but email not confirmed, show verification popup
  useEffect(() => {
    if (user && !isEmailConfirmed) {
      setRegisteredEmail(user.email ?? "");
      setShowVerifyEmail(true);
    }
  }, [user, isEmailConfirmed]);

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
      if (authMode === "login") {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
        // Show email verification popup after successful registration
        setRegisteredEmail(email.trim());
        setShowVerifyEmail(true);
      }
      setPassword("");
      // Navigation happens via auth guards (tabs layout).
    } catch (error) {
      console.warn("[login] submit failed", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBackToLogin() {
    setShowVerifyEmail(false);
    setAuthMode("login");
    setEmail(registeredEmail);
    setPassword("");
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
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 bg-background"
      >
        <View className="flex-1 px-4 justify-between">
          <View className="flex-1" />
          
          <View className="items-center">
            <Image
              source={require("../../assets/images/ponder-logo.png")}
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

            {/* OAuth disabled for now
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
            */}

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

      {/* Email Verification Modal */}
      <Modal
        visible={showVerifyEmail}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      >
        <SafeAreaView edges={["top", "bottom"]} style={styles.modalScreen}>
          <View style={styles.modalContent}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="email-outline" size={64} color="hsl(82 85% 55%)" />
            </View>

            {/* Title */}
            <Text style={styles.modalTitle}>Check your email</Text>

            {/* Description */}
            <Text style={styles.modalDescription}>
              We&apos;ve sent a verification link to
            </Text>
            <Text style={styles.emailText}>{registeredEmail}</Text>
            <Text style={styles.modalSubtext}>
              Click the link in the email to verify your account, then come back here to log in.
            </Text>

            {/* Back to Login */}
            <Pressable
              onPress={handleBackToLogin}
              accessibilityRole="button"
              style={styles.openMailButton}
            >
              <MaterialCommunityIcons name="arrow-left" size={20} color="rgba(0,0,0,0.90)" />
              <Text style={styles.openMailText}>Back to Login</Text>
            </Pressable>

            {/* Footer hint */}
            <Text style={styles.footerHint}>
              Didn&apos;t receive the email? Check your spam folder.
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalScreen: {
    flex: 1,
    backgroundColor: "hsl(0 0% 4%)",
  },
  modalContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  modalTitle: {
    fontFamily: "BebasNeue",
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.95)",
    textAlign: "center",
    marginBottom: 16,
  },
  modalDescription: {
    fontFamily: "SpaceMono",
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.70)",
    textAlign: "center",
  },
  emailText: {
    fontFamily: "SpaceMono",
    fontSize: 16,
    lineHeight: 24,
    color: "hsl(82 85% 55%)",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  modalSubtext: {
    fontFamily: "SpaceMono",
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.60)",
    textAlign: "center",
    maxWidth: 300,
    marginBottom: 40,
  },
  openMailButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "hsl(82 85% 55%)",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: "100%",
    maxWidth: 280,
  },
  openMailText: {
    fontFamily: "SpaceMono",
    fontSize: 14,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(0,0,0,0.90)",
  },
  footerHint: {
    fontFamily: "SpaceMono",
    fontSize: 12,
    color: "rgba(255,255,255,0.40)",
    textAlign: "center",
    marginTop: 40,
  },
});


