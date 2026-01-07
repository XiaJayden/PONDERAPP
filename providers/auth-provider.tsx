import type { Session, User } from "@supabase/supabase-js";
import * as AuthSession from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

// Completes the auth session on web (safe no-op on native). Keeps behavior consistent.
WebBrowser.maybeCompleteAuthSession();

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  errorMessage: string | null;

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
      try {
        const { data, error } = await supabase.auth.getSession();
        if (isCancelled) return;

        if (error) {
          console.warn("[auth] getSession failed", error);
          setErrorMessage(error.message);
        }

        setSession(data.session ?? null);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    void init();

    const { data: subscriptionData } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isCancelled) return;
      if (__DEV__) console.log("[auth] onAuthStateChange", { event: _event, hasSession: !!nextSession });
      setSession(nextSession);
    });

    return () => {
      isCancelled = true;
      subscriptionData.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    setErrorMessage(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("[auth] signIn failed", error);
      setErrorMessage(error.message);
      throw error;
    }
  }

  async function signUp(email: string, password: string) {
    setErrorMessage(null);

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.error("[auth] signUp failed", error);
      setErrorMessage(error.message);
      throw error;
    }
  }

  async function signOut() {
    setErrorMessage(null);

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[auth] signOut failed", error);
      setErrorMessage(error.message);
      throw error;
    }
  }

  async function signInWithGoogle() {
    setErrorMessage(null);

    // Uses your Expo scheme in `app.json` (currently: `pondrnative`).
    const redirectTo = AuthSession.makeRedirectUri({ scheme: "pondrnative" });

    if (__DEV__) console.log("[auth] signInWithGoogle redirectTo", { redirectTo });

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

    // Supabase OAuth returns `code` for PKCE.
    const parsed = Linking.parse(result.url);
    const code = parsed.queryParams?.code;

    if (!code || typeof code !== "string") {
      const err = new Error("[auth] OAuth redirect missing `code` param");
      console.error(err, { url: result.url, parsed });
      setErrorMessage(err.message);
      throw err;
    }

    const exchange = await supabase.auth.exchangeCodeForSession(code);
    if (exchange.error) {
      console.error("[auth] exchangeCodeForSession failed", exchange.error);
      setErrorMessage(exchange.error.message);
      throw exchange.error;
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      isLoading,
      errorMessage,
      signIn,
      signUp,
      signOut,
      signInWithGoogle,
    }),
    [session, isLoading, errorMessage]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


