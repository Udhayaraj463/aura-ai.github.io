const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

export type AuraProfile = {
  important_years: string[];
  places: string[];
  people: string[];
  hobbies: string[];
  critical_docs: string[];
};

export type Verdict = {
  category: "Legal Vault" | "Personal Memory" | "Document" | "Junk";
  is_junk: boolean;
  junk_reason: string | null;
  tags: string[];
  summary: string;
};

const VALID = new Set(["Legal Vault", "Personal Memory", "Document", "Junk"]);

function heuristic(fileName: string): Verdict {
  const n = fileName.toLowerCase();
  const junky = /(screenshot|meme|whatsapp|ad_|advert|temp|untitled|img_e|receipt)/.test(n);
  const legal = /(lease|contract|agreement|tuition|invoice|bill|certificate|passport|tax|insurance)/.test(
    n,
  );
  return {
    category: junky ? "Junk" : legal ? "Legal Vault" : "Document",
    is_junk: junky,
    junk_reason: junky ? "Filename pattern suggests a temporary or low-value file" : null,
    tags: [],
    summary: fileName,
  };
}

export async function classifyFile(input: {
  fileName: string;
  kind: string;
  mimeType?: string | null;
  dateTaken?: string | null;
  imageBase64?: string | null;
  profile: AuraProfile;
}): Promise<Verdict> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return heuristic(input.fileName);

  const p = input.profile;
  const system = `You are Aura's gatekeeper for a personal digital legacy vault. You decide what is worth keeping forever.
Return STRICT JSON only: {"category": "Legal Vault"|"Personal Memory"|"Document"|"Junk", "is_junk": boolean, "junk_reason": string|null, "tags": string[], "summary": string}

Rules:
- "Legal Vault": contracts, leases, tuition fees, utility bills, certificates, IDs, tax and insurance paperwork.
- "Personal Memory": meaningful photos, videos, voice notes of people, places, trips, hobbies, milestones.
- "Document": useful but ordinary paperwork or notes.
- "Junk": blurry or duplicate shots, ad screenshots, memes, app UI screenshots, temporary receipts, download clutter. Set is_junk=true for these and ONLY these.
- Be a hard gatekeeper: when a photo is blurry, an ad, a meme, or a random screenshot, mark it junk.
- summary: exactly one clear sentence. tags: 2-5 short lowercase tags.

The owner's context (use it to judge relevance):
Important years: ${p.important_years.join(", ") || "unknown"}
Places: ${p.places.join(", ") || "unknown"}
People: ${p.people.join(", ") || "unknown"}
Hobbies: ${p.hobbies.join(", ") || "unknown"}
Critical document types to always keep: ${p.critical_docs.join(", ") || "unknown"}`;

  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `File name: ${input.fileName}\nType: ${input.kind} (${input.mimeType ?? "unknown"})\nDate taken: ${
        input.dateTaken ?? "unknown"
      }`,
    },
  ];
  if (input.imageBase64) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${input.imageBase64}` },
    });
  }

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const message = await res.text();
    if (res.status === 429) throw new Error("Aura is rate limited right now — try again shortly.");
    if (res.status === 402)
      throw new Error("AI credits are exhausted. Add credits in Lovable to keep analysing files.");
    throw new Error(`AI analysis failed (${res.status}): ${message.slice(0, 200)}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = json.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, "").trim());
    const category = VALID.has(parsed.category) ? parsed.category : "Document";
    return {
      category,
      is_junk: Boolean(parsed.is_junk) || category === "Junk",
      junk_reason: parsed.junk_reason ?? null,
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(String) : [],
      summary: String(parsed.summary ?? input.fileName).slice(0, 300),
    };
  } catch {
    return heuristic(input.fileName);
  }
}
