import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const analyzeInput = z.object({
  fileId: z.string().uuid(),
  imageBase64: z.string().nullable().optional(),
});

export const analyzeFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => analyzeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { classifyFile } = await import("./gatekeeper.server");
    const supabase = context.supabase;

    const { data: file, error } = await supabase
      .from("files")
      .select("*")
      .eq("id", data.fileId)
      .single();
    if (error || !file) throw new Error("File not found");

    const { data: profile } = await supabase
      .from("profiles")
      .select("important_years, places, people, hobbies, critical_docs")
      .eq("user_id", context.userId)
      .maybeSingle();

    const verdict = await classifyFile({
      fileName: file.file_name,
      kind: file.kind,
      mimeType: file.mime_type,
      dateTaken: file.date_taken,
      imageBase64: data.imageBase64 ?? null,
      profile: {
        important_years: profile?.important_years ?? [],
        places: profile?.places ?? [],
        people: profile?.people ?? [],
        hobbies: profile?.hobbies ?? [],
        critical_docs: profile?.critical_docs ?? [],
      },
    });

    const { error: updateError } = await supabase
      .from("files")
      .update({
        category: verdict.category,
        tags: verdict.tags,
        summary: verdict.summary,
        is_junk: verdict.is_junk,
        junk_reason: verdict.junk_reason,
        status: "analyzed",
      })
      .eq("id", file.id);
    if (updateError) throw updateError;

    if (!verdict.is_junk && file.date_taken) {
      await supabase.from("memories").insert({
        user_id: context.userId,
        file_id: file.id,
        month_day: file.date_taken.slice(5, 10),
        year: Number(file.date_taken.slice(0, 4)),
        summary: verdict.summary,
        tags: verdict.tags,
      });
    }

    return verdict;
  });
