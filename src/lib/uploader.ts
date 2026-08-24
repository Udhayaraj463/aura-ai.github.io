import { unzipSync } from "fflate";
import { supabase } from "@/integrations/supabase/client";
import { analyzeFile } from "@/lib/vault.functions";
import { compressImage, fileToBase64, kindOf, readExifDate, toISODate } from "@/lib/aura";

export type UploadStage = "queued" | "extracting" | "compressing" | "uploading" | "analyzing" | "done" | "error";

export type UploadItem = {
  id: string;
  name: string;
  stage: UploadStage;
  progress: number;
  message?: string;
};

const SKIP = /(^|\/)(__MACOSX|\.DS_Store)/;

/** Flatten a drop: ZIP archives are expanded into their individual entries. */
export async function expandFiles(input: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of input) {
    if (kindOf(file.name, file.type) !== "archive") {
      out.push(file);
      continue;
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    const entries = unzipSync(buffer);
    for (const [path, bytes] of Object.entries(entries)) {
      if (!bytes.length || SKIP.test(path) || path.endsWith("/")) continue;
      const name = path.split("/").pop() ?? path;
      out.push(new File([bytes as BlobPart], name, { lastModified: file.lastModified }));
    }
  }
  return out;
}

export async function ingestFile(
  file: File,
  userId: string,
  onStage: (stage: UploadStage, progress: number) => void,
) {
  const kind = kindOf(file.name, file.type);

  onStage("compressing", 15);
  const exif = kind === "image" ? await readExifDate(file) : null;
  const dateTaken = exif ?? toISODate(file.lastModified);
  const payload = kind === "image" ? await compressImage(file) : file;

  onStage("uploading", 40);
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `${userId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("vault")
    .upload(storagePath, payload, { contentType: payload.type || file.type || undefined });
  if (uploadError) throw uploadError;

  const { data: row, error: insertError } = await supabase
    .from("files")
    .insert({
      user_id: userId,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: payload.size,
      kind,
      date_taken: dateTaken,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError || !row) throw insertError ?? new Error("Could not save the file record");

  onStage("analyzing", 70);
  const imageBase64 = kind === "image" ? await fileToBase64(payload) : null;
  await analyzeFile({ data: { fileId: row.id, imageBase64 } });

  onStage("done", 100);
}
