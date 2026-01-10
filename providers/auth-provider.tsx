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
  // - We keep this path stable so you can whitelist it in Supabase Redirect URLs.
  const scheme = "PONDERnative"; // keep in sync with `app.json` -> expo.scheme
  return Linking.createURL("auth/callback", { scheme }); // e.g. PONDERnative://auth/callback
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
        // Handle cold-start deep links (e.g. after OAuth redirect).
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          try {
            await exchangeCodeFromUrl(initialUrl);
          } catch (e) {
            if (__DEV__) console.warn("[auth] initial URL exchange failed", e);
          }
        }

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

    const redirectTo = getOAuthRedirectUrl();

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

    try {
      await exchangeCodeFromUrl(result.url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[auth] exchangeCodeFromUrl failed", e);
      setErrorMessage(msg);
      throw e;
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


