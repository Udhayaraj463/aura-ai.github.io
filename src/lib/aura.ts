export type FileKind = "image" | "video" | "audio" | "document" | "archive" | "other";

export type Category = "Legal Vault" | "Personal Memory" | "Document" | "Junk";

export const CATEGORIES: Category[] = ["Legal Vault", "Personal Memory", "Document", "Junk"];

const EXT_KIND: Record<string, FileKind> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  heic: "image",
  heif: "image",
  webp: "image",
  gif: "image",
  mp4: "video",
  mov: "video",
  webm: "video",
  m4v: "video",
  mp3: "audio",
  m4a: "audio",
  wav: "audio",
  ogg: "audio",
  aac: "audio",
  pdf: "document",
  docx: "document",
  doc: "document",
  txt: "document",
  zip: "archive",
};

export function extensionOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function kindOf(name: string, mime?: string): FileKind {
  const byExt = EXT_KIND[extensionOf(name)];
  if (byExt) return byExt;
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("video/")) return "video";
  if (mime?.startsWith("audio/")) return "audio";
  if (mime === "application/zip") return "archive";
  return "other";
}

export function formatBytes(bytes?: number | null) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Pull the EXIF DateTimeOriginal (YYYY:MM:DD) out of the head of a JPEG. */
export async function readExifDate(file: File): Promise<string | null> {
  try {
    const head = await file.slice(0, 256 * 1024).arrayBuffer();
    const bytes = new Uint8Array(head);
    let ascii = "";
    for (let i = 0; i < bytes.length; i++) ascii += String.fromCharCode(bytes[i]!);
    const match = ascii.match(/(19|20)\d{2}:[01]\d:[0-3]\d/);
    if (!match) return null;
    return match[0].replace(/:/g, "-");
  } catch {
    return null;
  }
}

export function toISODate(value: number | string | Date) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function monthDay(iso: string) {
  return iso.slice(5, 10);
}

export function yearsAgoLabel(year: number) {
  const diff = new Date().getFullYear() - year;
  if (diff <= 0) return "Earlier this year";
  if (diff === 1) return "1 year ago today";
  return `${diff} years ago today`;
}

export function fileToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Downscale an image so AI analysis stays cheap and uploads stay small. */
export async function compressImage(file: File, maxEdge = 1280): Promise<Blob> {
  if (typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}
