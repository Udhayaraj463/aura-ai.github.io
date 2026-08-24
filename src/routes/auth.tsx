import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Aperture, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GradientWave } from "@/components/ui/gradient-wave";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to Aura — Your Digital Legacy Vault" },
      {
        name: "description",
        content:
          "Sign in to Aura with Google to unlock your AI-curated vault of documents and personal memories.",
      },
      { property: "og:title", content: "Sign in to Aura" },
      {
        property: "og:description",
        content: "Access your private digital legacy vault and smart memory capsule.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const go = async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("user_id", userId)
        .maybeSingle();
      navigate({ to: data?.onboarded ? "/vault" : "/onboarding" });
    };

    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) go(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) go(session.user.id);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const signIn = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Could not sign in with Google. Please try again.");
      return;
    }
    if (result.redirected) return;
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5">
      <GradientWave
        className="opacity-45"
        colors={["#101a24", "#2dd4bf", "#101a24", "#f5a524", "#101a24", "#7dd3fc"]}
        deform={{ incline: 0.4, noiseAmp: 220, noiseFlow: 4 }}
      />
      <div className="pointer-events-none absolute inset-0 bg-veil" />

      <div className="glass-panel relative z-10 w-full max-w-md rounded-3xl p-10 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary">
          <Aperture className="size-6 text-primary" />
        </div>
        <h1 className="mt-6 text-4xl">Welcome to Aura</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your private vault for the documents and memories that deserve to outlive the clutter.
        </p>

        <Button className="mt-8 w-full" size="lg" onClick={signIn} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
          Continue with Google
        </Button>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Aura only ever reads your files to sort them. Everything stays in your private vault.
        </p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.9h5.35c-.23 1.4-1.63 4.1-5.35 4.1a5.9 5.9 0 1 1 0-11.8c1.7 0 2.85.72 3.5 1.35l2.4-2.3C16.4 3.9 14.4 3 12 3a9 9 0 1 0 0 18c5.2 0 8.65-3.65 8.65-8.8 0-.6-.1-1.05-.3-1.1Z"
      />
    </svg>
  );
}
