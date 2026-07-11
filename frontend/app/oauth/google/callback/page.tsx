"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function GoogleOAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <GoogleOAuthCallbackPageInner />
    </Suspense>
  );
}

function GoogleOAuthCallbackPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const run = async () => {
      try {
        const code = searchParams.get("code");
        const state = searchParams.get("state");

        if (!code || !state) {
          router.replace("/login");
          return;
        }

        const apiBaseUrl =
          process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
        const response = await fetch(
          `${apiBaseUrl}/api/oauth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
          {
            credentials: "include",
          },
        );

        const responseText = await response.text();
        console.log("[GoogleOAuthCallback] status:", response.status);
        console.log("[GoogleOAuthCallback] body:", responseText);

        let payload: {
          error?: string;
          nextRoute?: string;
          user?: { profileComplete?: boolean };
        } | null = null;
        try {
          payload = responseText ? JSON.parse(responseText) : null;
        } catch (parseError) {
          console.error("[GoogleOAuthCallback] JSON parse failed:", parseError);
          payload = null;
        }

        const nextRoute =
          payload?.nextRoute ??
          (payload?.user?.profileComplete ? "/home" : "/profile-setup");

        if (!response.ok) {
          console.warn("[GoogleOAuthCallback] non-OK response, redirecting to:", nextRoute);
          if (nextRoute) {
            router.replace(nextRoute);
            return;
          }
          throw new Error(payload?.error ?? "Google sign-in failed");
        }

        console.log("[GoogleOAuthCallback] redirecting to:", nextRoute);
        router.replace(nextRoute);
      } catch {
        router.replace("/login");
      }
    };

    void run();
  }, [router, searchParams]);

  return (
    <main className="auth-page auth-page-center">
      <div className="auth-center-shell">
        <p>Signing you in with Google...</p>
      </div>
    </main>
  );
}
