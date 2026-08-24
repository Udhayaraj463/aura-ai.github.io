import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileAudio,
  FileText,
  FileVideo,
  ImageIcon,
  Loader2,
  Package,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { formatBytes, type FileKind } from "@/lib/aura";
import { expandFiles, ingestFile, type UploadItem } from "@/lib/uploader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/vault")({
  head: () => ({
    meta: [
      { title: "Your Aura Vault — Smart file triage" },
      {
        name: "description",
        content:
          "Drop photos, videos, voice notes, documents or ZIP archives and let Aura sort keepsakes from clutter automatically.",
      },
      { property: "og:title", content: "Your Aura Vault" },
      {
        property: "og:description",
        content: "AI-sorted memories, legal documents and quarantined clutter in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VaultPage,
});

type FileRow = {
  id: string;
  file_name: string;
  storage_path: string;
  kind: string;
  size_bytes: number | null;
  date_taken: string | null;
  category: string;
  tags: string[];
  summary: string | null;
  is_junk: boolean;
  junk_reason: string | null;
  status: string;
};

const KIND_ICON: Record<string, typeof ImageIcon> = {
  image: ImageIcon,
  video: FileVideo,
  audio: FileAudio,
  document: FileText,
  archive: Package,
  other: FileText,
};

function VaultPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [purging, setPurging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("files")
      .select(
        "id, file_name, storage_path, kind, size_bytes, date_taken, category, tags, summary, is_junk, junk_reason, status",
      )
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    setRows((data as FileRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      refresh(data.user.id);
    });
  }, [refresh]);

  useEffect(() => {
    const images = rows.filter((r) => r.kind === "image" && !thumbs[r.id]).slice(0, 60);
    if (!images.length) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.storage
        .from("vault")
        .createSignedUrls(images.map((r) => r.storage_path), 3600);
      if (cancelled || !data) return;
      const next: Record<string, string> = {};
      data.forEach((entry, i) => {
        if (entry.signedUrl) next[images[i].id] = entry.signedUrl;
      });
      setThumbs((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [rows, thumbs]);

  const vault = useMemo(() => rows.filter((r) => !r.is_junk), [rows]);
  const junk = useMemo(() => rows.filter((r) => r.is_junk), [rows]);

  const handleFiles = async (list: FileList | File[]) => {
    if (!userId) return;
    const incoming = Array.from(list);
    if (!incoming.length) return;

    const archiveCount = incoming.filter((f) => f.name.toLowerCase().endsWith(".zip")).length;
    if (archiveCount) toast.info(`Extracting ${archiveCount} archive${archiveCount > 1 ? "s" : ""}…`);

    let files: File[];
    try {
      files = await expandFiles(incoming);
    } catch {
      toast.error("That archive could not be extracted.");
      return;
    }

    const items: UploadItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      stage: "queued",
      progress: 0,
    }));
    setQueue((q) => [...items, ...q]);

    for (let i = 0; i < files.length; i++) {
      const item = items[i];
      try {
        await ingestFile(files[i], userId, (stage, progress) =>
          setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, stage, progress } : x))),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setQueue((q) =>
          q.map((x) => (x.id === item.id ? { ...x, stage: "error", progress: 100, message } : x)),
        );
        toast.error(message);
      }
    }

    await refresh(userId);
    setTimeout(() => setQueue((q) => q.filter((x) => x.stage === "error")), 2500);
  };

  const purgeJunk = async () => {
    if (!userId || !junk.length) return;
    setPurging(true);
    await supabase.storage.from("vault").remove(junk.map((j) => j.storage_path));
    await supabase
      .from("files")
      .delete()
      .in("id", junk.map((j) => j.id));
    await refresh(userId);
    setPurging(false);
    toast.success(`Cleared ${junk.length} cluttered file${junk.length > 1 ? "s" : ""}.`);
  };

  const active = queue.filter((q) => q.stage !== "done");

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl">Ingestion hub</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Drop anything — photos, clips, voice notes, paperwork or a whole ZIP export. Aura reads
            each one, keeps what matters and quarantines the rest.
          </p>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <p className="font-display text-3xl text-primary">{vault.length}</p>
            <p className="text-muted-foreground">kept</p>
          </div>
          <div>
            <p className="font-display text-3xl text-muted-foreground">{junk.length}</p>
            <p className="text-muted-foreground">clutter</p>
          </div>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "glass-panel mt-8 cursor-pointer rounded-3xl border-dashed p-12 text-center transition-all",
          dragging && "glow-ring border-primary",
        )}
      >
        <UploadCloud className="mx-auto size-8 text-primary" />
        <p className="mt-4 font-display text-2xl">Drop files or a ZIP archive here</p>
        <p className="mt-2 text-sm text-muted-foreground">
          .zip · .jpg .png .heic · .mp4 .mov · .mp3 .m4a .wav · .pdf .docx
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept=".zip,image/*,video/*,audio/*,.pdf,.docx,.doc"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {active.length > 0 && (
        <div className="glass-panel mt-6 space-y-3 rounded-2xl p-5">
          {active.slice(0, 8).map((item) => (
            <div key={item.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="truncate">{item.name}</span>
                <span
                  className={cn(
                    "shrink-0 text-xs capitalize",
                    item.stage === "error" ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {item.stage === "error" ? (item.message ?? "failed") : item.stage}
                </span>
              </div>
              <Progress value={item.progress} />
            </div>
          ))}
          {active.length > 8 && (
            <p className="text-xs text-muted-foreground">+ {active.length - 8} more queued</p>
          )}
        </div>
      )}

      <Tabs defaultValue="vault" className="mt-12">
        <TabsList>
          <TabsTrigger value="vault">Vault · {vault.length}</TabsTrigger>
          <TabsTrigger value="junk">Clutter · {junk.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="vault" className="mt-6">
          {loading ? (
            <Loading />
          ) : vault.length === 0 ? (
            <Empty label="Nothing in the vault yet. Upload something above." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {vault.map((row) => (
                <FileCard key={row.id} row={row} thumb={thumbs[row.id]} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="junk" className="mt-6 space-y-5">
          {junk.length > 0 && (
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-secondary/40 px-5 py-4">
              <p className="text-sm text-muted-foreground">
                {junk.length} quarantined file{junk.length > 1 ? "s" : ""} taking up{" "}
                {formatBytes(junk.reduce((sum, j) => sum + (j.size_bytes ?? 0), 0))}.
              </p>
              <Button variant="destructive" onClick={purgeJunk} disabled={purging}>
                {purging ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Delete all
              </Button>
            </div>
          )}
          {loading ? (
            <Loading />
          ) : junk.length === 0 ? (
            <Empty label="No clutter detected. Your vault is clean." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {junk.map((row) => (
                <FileCard key={row.id} row={row} thumb={thumbs[row.id]} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function FileCard({ row, thumb }: { row: FileRow; thumb?: string }) {
  const Icon = KIND_ICON[row.kind as FileKind] ?? FileText;
  return (
    <article className="glass-panel overflow-hidden rounded-2xl">
      <div className="relative flex h-36 items-center justify-center bg-secondary/50">
        {thumb ? (
          <img src={thumb} alt={row.file_name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Icon className="size-8 text-muted-foreground" />
        )}
        <Badge
          variant={row.is_junk ? "outline" : "default"}
          className="absolute left-3 top-3 backdrop-blur-sm"
        >
          {row.category}
        </Badge>
      </div>

      <div className="space-y-3 p-5">
        <div>
          <h3 className="truncate font-sans text-sm font-medium">{row.file_name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {row.date_taken ?? "undated"} · {formatBytes(row.size_bytes)}
          </p>
        </div>

        {row.status === "pending" ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Awaiting analysis
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {row.is_junk ? (row.junk_reason ?? row.summary) : row.summary}
          </p>
        )}

        {row.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {row.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Loading your vault…
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
      <Sparkles className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
