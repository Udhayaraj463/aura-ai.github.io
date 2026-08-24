import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Sparkles, Clock, FolderArchive } from "lucide-react";

import { ImageStreamHero, type StreamImage } from "@/components/ui/image-stream-hero";
import { GradientWave } from "@/components/ui/gradient-wave";
import { Button } from "@/components/ui/button";

import memory1 from "@/assets/memory-1.jpg";
import memory2 from "@/assets/memory-2.jpg";
import memory3 from "@/assets/memory-3.jpg";
import memory4 from "@/assets/memory-4.jpg";
import memory5 from "@/assets/memory-5.jpg";
import memory6 from "@/assets/memory-6.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aura — Digital Legacy Vault & Smart Memories" },
      {
        name: "description",
        content:
          "Aura is an AI-guarded vault for the files that matter: legal documents, family photos and the memories worth keeping. Everything else gets filtered out.",
      },
      { property: "og:title", content: "Aura — Digital Legacy Vault & Smart Memories" },
      {
        property: "og:description",
        content:
          "An AI gatekeeper sorts your uploads into a private legacy vault, surfaces memories on their anniversary, and quietly discards the clutter.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const streamImages: StreamImage[] = [
  { src: memory1 },
  { src: memory2 },
  { src: memory3 },
  { src: memory4 },
  { src: memory5 },
  { src: memory6 },
];

const pillars = [
  {
    icon: ShieldCheck,
    title: "AI Gatekeeper",
    body: "Every upload is read, understood and judged. Passports, deeds and policies go straight to the vault; screenshots and blurry duplicates never make it in.",
  },
  {
    icon: FolderArchive,
    title: "One ingestion hub",
    body: "Photos, video, audio, PDFs — even whole ZIP archives. Drop them in once and Aura unpacks, compresses and files everything for you.",
  },
  {
    icon: Clock,
    title: "Memory Capsule",
    body: "On this day, years ago. Aura resurfaces the moments tied to today's date so a legacy stays lived-in, not locked away.",
  },
];

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <ImageStreamHero images={streamImages} cards={9} speed={26} axis={52}>
        <div className="mx-auto flex min-h-[92vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
          <span className="glass-panel rounded-full px-4 py-1.5 text-xs tracking-[0.2em] uppercase text-muted-foreground">
            Digital legacy vault
          </span>
          <h1 className="mt-8 text-5xl leading-[1.05] sm:text-7xl">
            Keep what <span className="text-aurora">matters</span>.
            <br />
            Forget the rest.
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Aura is a private, AI-guarded vault for your documents and memories. It reads what
            you upload, files the meaningful, and quietly filters out the noise.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Open your vault
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#how">How it works</a>
            </Button>
          </div>
        </div>
      </ImageStreamHero>

      <section id="how" className="mx-auto max-w-6xl px-6 py-28">
        <div className="max-w-2xl">
          <Sparkles className="size-6 text-primary" />
          <h2 className="mt-4 text-4xl sm:text-5xl">A vault with judgement.</h2>
          <p className="mt-4 text-muted-foreground">
            Aura learns the years, places and people that define you during onboarding, then uses
            that context to decide what deserves to be kept forever.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {pillars.map(({ icon: Icon, title, body }) => (
            <article key={title} className="glass-panel rounded-2xl p-7">
              <Icon className="size-6 text-primary" />
              <h3 className="mt-5 text-2xl">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative isolate overflow-hidden">
        <GradientWave className="absolute inset-0 -z-10" />
        <div className="mx-auto max-w-3xl px-6 py-32 text-center">
          <h2 className="text-4xl sm:text-5xl">Your story deserves an archivist.</h2>
          <p className="mt-5 text-muted-foreground">
            Start with a few questions. Aura takes it from there.
          </p>
          <Button asChild size="lg" className="mt-10">
            <Link to="/auth">
              Get started free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-10 text-center text-xs text-muted-foreground">
        Aura — a private place for the things worth keeping.
      </footer>
    </main>
  );
}
