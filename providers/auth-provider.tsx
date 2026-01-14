import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

// Completes the auth session on web (safe no-op on native). Keeps behavior consistent.
WebBrowser.maybeCompleteAuthSession();

function getOAuthRedirectUrl() {
  // IMPORTANT:
  // - Custom scheme redirects require a Dev Client / standalone build (not Expo Go).
  // - This URL MUST be added to Supabase Dashboard:
  //   Authentication → URL Configuration → Redirect URLs
  //   Add: PONDERnative://auth/callback
  // - Without this, Supabase will redirect to your site URL instead of the app.
  const scheme = "pondernative"; // keep in sync with `app.json` -> expo.scheme
  const redirectUrl = Linking.createURL("auth/callback", { scheme }); // e.g. PONDERnative://auth/callback
  return redirectUrl;
}

function getEmailRedirectUrl() {
  // For email confirmation, we need a WEB URL that then redirects to the app.
  // Custom schemes (PONDERnative://) can't be opened directly from server redirects.
  //
  // Set EXPO_PUBLIC_SITE_URL to your hosted web URL (e.g., https://yourapp.com)
  // The web page at /auth/callback will redirect to the native app.
  const siteUrl = process.env.EXPO_PUBLIC_SITE_URL;

  if (!siteUrl) {
    if (__DEV__) {
      console.warn(
        "[auth] EXPO_PUBLIC_SITE_URL not set. Email confirmation links will redirect to Supabase Site URL.\n" +
          "Set EXPO_PUBLIC_SITE_URL to your web URL (e.g., https://yourapp.com) for proper app redirects."
      );
    }
    // Fall back to native scheme (won't work for email, but will work for OAuth)
    return getOAuthRedirectUrl();
  }

  // Remove trailing slash from siteUrl to avoid double slashes
  const cleanSiteUrl = siteUrl.replace(/\/$/, "");
  return `${cleanSiteUrl}/auth/callback`;
}

async function exchangeCodeFromUrl(url: string) {
  // Supabase OAuth (PKCE) returns `code` as a query param in the redirect.
  const parsed = Linking.parse(url);
  const code = parsed.queryParams?.code;
  const error = parsed.queryParams?.error;
  const errorDescription = parsed.queryParams?.error_description;

  if (error) {
    throw new Error(typeof errorDescription === "string" ? errorDescription : String(error));
  }

  if (!code || typeof code !== "string") {
    throw new Error("[auth] OAuth redirect missing `code` param");
  }

  const exchange = await supabase.auth.exchangeCodeForSession(code);
  if (exchange.error) throw exchange.error;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  errorMessage: string | null;
  isEmailConfirmed: boolean;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function init() {
      if (__DEV__) {
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("[auth] 🚀 INIT STARTED");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      }
      try {
        // Handle cold-start deep links (e.g. after OAuth redirect).
        const initialUrl = await Linking.getInitialURL();
        if (__DEV__) console.log("[auth] Initial URL:", initialUrl);
        if (initialUrl) {
          try {
            await exchangeCodeFromUrl(initialUrl);
            if (__DEV__) console.log("[auth] ✅ Initial URL code exchange succeeded");
          } catch (e) {
            if (__DEV__) console.warn("[auth] ⚠️ Initial URL exchange failed", e);
          }
        }

        if (__DEV__) console.log("[auth] Getting existing session...");
        const { data, error } = await supabase.auth.getSession();
        if (isCancelled) return;

        if (error) {
          console.warn("[auth] ❌ getSession failed", error);
          setErrorMessage(error.message);
        }

        if (__DEV__) {
          console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          console.log("[auth] 📦 EXISTING SESSION CHECK");
          console.log("  hasSession:", !!data.session);
          if (data.session?.user) {
            console.log("  user.id:", data.session.user.id);
            console.log("  user.email:", data.session.user.email);
            console.log("  user.email_confirmed_at:", data.session.user.email_confirmed_at);
            console.log("  isEmailConfirmed:", Boolean(data.session.user.email_confirmed_at));
          }
          console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        }

        setSession(data.session ?? null);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
          if (__DEV__) console.log("[auth] 🏁 INIT COMPLETE, isLoading = false");
        }
      }
    }

    void init();

    const { data: subscriptionData } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isCancelled) return;
      if (__DEV__) {
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("[auth] 🔄 onAuthStateChange");
        console.log("  event:", _event);
        console.log("  hasSession:", !!nextSession);
        if (nextSession?.user) {
          console.log("  user.id:", nextSession.user.id);
          console.log("  user.email:", nextSession.user.email);
          console.log("  user.email_confirmed_at:", nextSession.user.email_confirmed_at);
          console.log("  isEmailConfirmed:", Boolean(nextSession.user.email_confirmed_at));
        }
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      }
      setSession(nextSession);
    });

    const urlSub = Linking.addEventListener("url", ({ url }) => {
      // Best-effort: if app is opened via OAuth redirect, exchange the code for a session.
      void (async () => {
        try {
          await exchangeCodeFromUrl(url);
        } catch (e) {
          if (__DEV__) console.warn("[auth] url event exchange failed", e);
        }
      })();
    });

    return () => {
      isCancelled = true;
      subscriptionData.subscription.unsubscribe();
      urlSub.remove();
    };
  }, []);

  async function signIn(email: string, password: string) {
    setErrorMessage(null);

    if (__DEV__) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[auth] 🔐 signIn STARTED");
      console.log("  email:", email);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (__DEV__) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[auth] 🔐 signIn RESPONSE");
      console.log("  hasError:", !!error);
      console.log("  hasData:", !!data);
      console.log("  hasSession:", !!data?.session);
      console.log("  hasUser:", !!data?.user);
      if (error) {
        console.log("  error.message:", error.message);
        console.log("  error.status:", (error as any).status);
        console.log("  error.name:", error.name);
      }
      if (data?.user) {
        console.log("  user.id:", data.user.id);
        console.log("  user.email:", data.user.email);
        console.log("  user.email_confirmed_at:", data.user.email_confirmed_at);
        console.log("  user.created_at:", data.user.created_at);
        console.log("  user.updated_at:", data.user.updated_at);
      }
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    if (error) {
      console.error("[auth] ❌ signIn FAILED", error);
      setErrorMessage(error.message);
      throw error;
    }

    // Email confirmation check disabled - Supabase handles this via dashboard settings
    if (__DEV__) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[auth] ✅ signIn SUCCESS");
      console.log("  email_confirmed_at:", data.user?.email_confirmed_at ?? "null (confirmation disabled)");
      console.log("  Navigation should happen via auth guards...");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }
  }

  async function signUp(email: string, password: string) {
    setErrorMessage(null);

    const emailRedirectTo = getEmailRedirectUrl();

    if (__DEV__) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[auth] 📝 signUp STARTED");
      console.log("  email:", email);
      console.log("  emailRedirectTo:", emailRedirectTo);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // This tells Supabase where to redirect after email confirmation.
        // Must be a WEB URL that then redirects to the native app.
        emailRedirectTo,
      },
    });

    if (__DEV__) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[auth] 📝 signUp RESPONSE");
      console.log("  hasError:", !!error);
      console.log("  hasData:", !!data);
      console.log("  hasSession:", !!data?.session);
      console.log("  hasUser:", !!data?.user);
      if (data?.user) {
        console.log("  user.id:", data.user.id);
        console.log("  user.email:", data.user.email);
        console.log("  user.email_confirmed_at:", data.user.email_confirmed_at);
        console.log("  user.identities:", data.user.identities?.length ?? 0);
      }
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    if (error) {
      console.error("[auth] ❌ signUp FAILED", error);
      setErrorMessage(error.message);
      throw error;
    }

    // Check if user already exists (Supabase returns user with empty identities array)
    // This happens when someone tries to sign up with an existing email
    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      if (__DEV__) {
        console.log("[auth] ⚠️ User already exists - please login instead");
      }
      setErrorMessage("An account with this email already exists. Please login instead.");
      throw new Error("User already exists");
    }

    // If we got a session back (email confirmation disabled), the user is auto-logged in
    if (data.session) {
      if (__DEV__) {
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("[auth] ✅ signUp SUCCESS - Auto logged in (email confirmation disabled)");
        console.log("  Session will be set via onAuthStateChange");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      }
      // Session is already set by onAuthStateChange listener, navigation will happen automatically
    } else {
      if (__DEV__) {
        console.log("[auth] ✅ signUp SUCCESS - Email confirmation required");
        console.log("  User needs to click the link in their email");
      }
    }
  }

  async function signOut() {
    setErrorMessage(null);

    const { error } = await supabase.auth.signOut();
    if (error) {
      // If there's no session, the user is effectively already logged out - not an error
      if (error.name === "AuthSessionMissingError") {
        if (__DEV__) console.log("[auth] signOut: no session to sign out from (already logged out)");
        setSession(null);
        return;
      }
      console.error("[auth] signOut failed", error);
      setErrorMessage(error.message);
      throw error;
    }
  }

  async function signInWithGoogle() {
    setErrorMessage(null);

    const redirectTo = getOAuthRedirectUrl();

    if (__DEV__) {
      console.log("[auth] signInWithGoogle redirectTo", { redirectTo });
      console.log("[auth] IMPORTANT: Ensure this URL is in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:", redirectTo);
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        // For RN, we want the URL back so we can open it in an auth session.
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      console.error("[auth] signInWithGoogle init failed", error);
      setErrorMessage(error.message);
      throw error;
    }

    if (!data.url) {
      const err = new Error("[auth] Missing OAuth URL from Supabase");
      console.error(err);
      setErrorMessage(err.message);
      throw err;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (__DEV__) console.log("[auth] OAuth result", result);

    if (result.type !== "success" || !result.url) return;

    try {
      await exchangeCodeFromUrl(result.url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[auth] exchangeCodeFromUrl failed", e);
      setErrorMessage(msg);
      throw e;
    }
  }

  // Email confirmation disabled - always treat as confirmed
  // To re-enable: change to Boolean(session?.user?.email_confirmed_at)
  const isEmailConfirmed = true;

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      isLoading,
      errorMessage,
      isEmailConfirmed,
      signIn,
      signUp,
      signOut,
      signInWithGoogle,
    }),
    [session, isLoading, errorMessage, isEmailConfirmed]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


