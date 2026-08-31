import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TagField } from "@/components/TagField";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your Aura context" },
      {
        name: "description",
        content:
          "Tell Aura about the years, places, people, hobbies and paperwork that matter so the AI can sort your files.",
      },
      { property: "og:title", content: "Set up your Aura context" },
      {
        property: "og:description",
        content: "A five-step wizard that teaches Aura what is worth keeping.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

type FormState = {
  important_years: string[];
  places: string[];
  people: string[];
  hobbies: string[];
  critical_docs: string[];
};

const STEPS: Array<{
  key: keyof FormState;
  title: string;
  blurb: string;
  placeholder: string;
  suggestions: string[];
}> = [
  {
    key: "important_years",
    title: "Which years shaped you?",
    blurb: "Aura leans on these when deciding what deserves a place in the vault.",
    placeholder: "e.g. 2018",
    suggestions: ["2018", "2022", "2026"],
  },
  {
    key: "places",
    title: "Where does your life happen?",
    blurb: "Cities, campuses, the family home — anywhere your memories are anchored.",
    placeholder: "e.g. Taipei",
    suggestions: ["Taipei", "YZU campus", "Home town"],
  },
  {
    key: "people",
    title: "Who matters most?",
    blurb: "Names or groups. Photos featuring them get treated as keepsakes.",
    placeholder: "e.g. Family",
    suggestions: ["Family", "Best friends", "Co-workers"],
  },
  {
    key: "hobbies",
    title: "What do you love doing?",
    blurb: "Hobbies and extracurriculars help Aura tell passion from noise.",
    placeholder: "e.g. Badminton",
    suggestions: ["Badminton", "Street photography", "Gaming"],
  },
  {
    key: "critical_docs",
    title: "What paperwork must never be lost?",
    blurb: "These go straight to the Legal Vault, never to clutter.",
    placeholder: "e.g. Lease agreements",
    suggestions: ["Tuition fees", "Electricity bills", "Lease agreements", "Certificates"],
  },
];

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    important_years: [],
    places: [],
    people: [],
    hobbies: [],
    critical_docs: [],
  });

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("important_years, places, people, hobbies, critical_docs")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (profile) {
        setForm({
          important_years: profile.important_years ?? [],
          places: profile.places ?? [],
          people: profile.people ?? [],
          hobbies: profile.hobbies ?? [],
          critical_docs: profile.critical_docs ?? [],
        });
      }
    });
  }, []);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const finish = async () => {
    setSaving(true);
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: data.user.id, ...form, onboarded: true, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      toast.error("Could not save your profile. Please try again.");
      return;
    }
    toast.success("Aura now knows what matters to you.");
    navigate({ to: "/vault" });
  };

  if (!current) return null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-5 py-16">
      <p className="text-sm text-muted-foreground">
        Step {step + 1} of {STEPS.length}
      </p>
      <Progress value={((step + 1) / STEPS.length) * 100} className="mt-3" />

      <h1 className="mt-10 text-4xl sm:text-5xl">{current.title}</h1>
      <p className="mt-3 text-muted-foreground">{current.blurb}</p>

      <div className="glass-panel mt-8 rounded-2xl p-6">
        <TagField
          values={form[current.key]}
          onChange={(next) => setForm((f) => ({ ...f, [current.key]: next }))}
          placeholder={current.placeholder}
          suggestions={current.suggestions}
        />
      </div>

      <div className="mt-10 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="size-4" /> Back
        </Button>

        {isLast ? (
          <Button size="lg" onClick={finish} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Enter my vault
          </Button>
        ) : (
          <Button size="lg" onClick={() => setStep((s) => s + 1)}>
            Continue <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
