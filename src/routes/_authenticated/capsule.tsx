import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarHeart, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { yearsAgoLabel } from "@/lib/aura";

export const Route = createFileRoute("/_authenticated/capsule")({
  head: () => ({
    meta: [
      { title: "Memory Capsule — On this day in your Aura vault" },
      {
        name: "description",
        content:
          "Relive what happened on this date across every year of your life, curated automatically by Aura.",
      },
      { property: "og:title", content: "Memory Capsule" },
      {
        property: "og:description",
        content: "A year-by-year timeline of your memories from this exact date.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CapsulePage,
});

type MemoryRow = {
  id: string;
  year: number;
  summary: string | null;
  tags: string[];
  files: {
    file_name: string;
    storage_path: string;
    kind: string;
    category: string;
    date_taken: string | null;
    is_junk: boolean;
  } | null;
};

function CapsulePage() {
  const [rows, setRows] = useState<MemoryRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from("memories")
        .select(
          "id, year, summary, tags, files!inner(file_name, storage_path, kind, category, date_taken, is_junk)",
        )
        .eq("user_id", auth.user.id)
        .eq("month_day", today)
        .eq("files.is_junk", false)
        .order("year", { ascending: false });

      const list = ((data ?? []) as unknown as MemoryRow[]).filter((r) => r.files);
      setRows(list);
      setLoading(false);

      const images = list.filter((r) => r.files?.kind === "image");
      if (images.length) {
        const { data: signed } = await supabase.storage
          .from("vault")
          .createSignedUrls(images.map((r) => r.files!.storage_path), 3600);
        const next: Record<string, string> = {};
        signed?.forEach((entry, i) => {
          const img = images[i];
          if (img && entry.signedUrl) next[img.id] = entry.signedUrl;
        });
        setUrls(next);
      }
    })();
  }, [today]);

  const byYear = useMemo(() => {
    const map = new Map<number, MemoryRow[]>();
    rows.forEach((row) => {
      map.set(row.year, [...(map.get(row.year) ?? []), row]);
    });
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [rows]);

  const prettyDate = new Date().toLocaleDateString(undefined, { month: "long", day: "numeric" });

  return (
    <AppShell>
      <div className="flex items-center gap-3 text-primary">
        <CalendarHeart className="size-5" />
        <span className="text-sm uppercase tracking-[0.2em]">On this day</span>
      </div>
      <h1 className="mt-4 text-4xl sm:text-5xl">{prettyDate}, through the years</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Every keepsake Aura has filed under this date, newest year first.
      </p>

      {loading ? (
        <div className="mt-16 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Opening the capsule…
        </div>
      ) : byYear.length === 0 ? (
        <div className="mt-16 rounded-3xl border border-dashed border-border py-20 text-center">
          <p className="font-display text-2xl">Nothing from this day — yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload older photos and Aura will place them on this timeline automatically.
          </p>
        </div>
      ) : (
        <div className="relative mt-14 space-y-16 border-l border-border pl-8">
          {byYear.map(([year, items]) => (
            <section key={year} className="relative">
              <span className="absolute -left-[38px] top-2 size-3 rounded-full bg-aurora" />
              <p className="text-sm uppercase tracking-[0.18em] text-primary">
                {yearsAgoLabel(year)}
              </p>
              <h2 className="mt-1 text-3xl">{year}</h2>

              <div className="mt-6 flex snap-x gap-4 overflow-x-auto pb-4">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="glass-panel w-72 shrink-0 snap-start overflow-hidden rounded-2xl"
                  >
                    <div className="flex h-48 items-center justify-center bg-secondary/50">
                      {urls[item.id] ? (
                        <img
                          src={urls[item.id]}
                          alt={item.summary ?? item.files?.file_name ?? "Memory"}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="px-6 text-center font-display text-xl text-muted-foreground">
                          {item.files?.file_name}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 p-5">
                      <p className="text-sm leading-relaxed">{item.summary}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
