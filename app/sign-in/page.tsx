"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { LoginCard } from "@/components/spectrumui/logincard";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = () => {
    setError(null);
    setLoading(true);
    void signIn("google", { redirectTo: "/" }).catch((err) => {
      setError("Sign-in failed. Check Google OAuth keys in the Convex dashboard (" + (err?.message || "OAuth error") + ").");
      setLoading(false);
    });
  };

  const handleGuest = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("anonymous", { redirectTo: "/" });
      if (res && "redirect" in res && res.redirect) {
        window.location.href = res.redirect.toString();
      } else {
        window.location.href = "/";
      }
    } catch (err) {
      setError("Guest sign-in failed: " + (err instanceof Error ? err.message : "Unknown error"));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 gap-4">
      <LoginCard onGoogleSignIn={handleGoogle} onGuestSignIn={handleGuest} loading={loading} />
      {error && (
        <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
