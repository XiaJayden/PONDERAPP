"use client";

import { useEffect, useState } from "react";

/**
 * Web redirect page for Supabase email confirmation.
 *
 * Flow:
 * 1. User clicks email confirmation link
 * 2. Supabase verifies token and redirects here with tokens in URL hash/params
 * 3. This page redirects to the native app with the tokens
 */
export default function AuthCallbackPage() {
  const [status, setStatus] = useState<"redirecting" | "error" | "manual">("redirecting");
  const [appUrl, setAppUrl] = useState<string>("");

  useEffect(() => {
    // Get the full URL including hash fragment (Supabase puts tokens in the hash)
    const hash = window.location.hash;
    const search = window.location.search;

    // Build the native app URL with the same params/hash
    const nativeUrl = `pondernative://auth/callback${search}${hash}`;
    setAppUrl(nativeUrl);

    // Try to open the app
    const timeout = setTimeout(() => {
      // If we're still here after 2 seconds, show manual link
      setStatus("manual");
    }, 2000);

    // Attempt to redirect to the app
    window.location.href = nativeUrl;

    return () => clearTimeout(timeout);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
        backgroundColor: "#0a0a0a",
        color: "#fafafa",
      }}
    >
      {status === "redirecting" && (
        <>
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid #333",
              borderTopColor: "#fff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <p style={{ marginTop: "1.5rem", color: "#888" }}>
            Opening PONDR...
          </p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </>
      )}

      {status === "manual" && (
        <>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            Email Confirmed! ✓
          </h1>
          <p style={{ color: "#888", marginBottom: "1.5rem", textAlign: "center" }}>
            If the app didn&apos;t open automatically, tap the button below:
          </p>
          <a
            href={appUrl}
            style={{
              padding: "0.75rem 2rem",
              backgroundColor: "#fff",
              color: "#000",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Open PONDR
          </a>
          <p
            style={{
              marginTop: "2rem",
              fontSize: "0.75rem",
              color: "#666",
              textAlign: "center",
            }}
          >
            Make sure you have PONDR installed on your device.
          </p>
        </>
      )}
    </div>
  );
}
