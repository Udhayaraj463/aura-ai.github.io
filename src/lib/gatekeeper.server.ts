/**
 * Aura's AI gatekeeper.
 *
 * Bring-your-own AI: configure these server-side env vars (never exposed to
 * the browser). Any OpenAI-compatible /chat/completions endpoint works —
 * OpenAI, Groq, Together, OpenRouter, vLLM, LM Studio, a self-hosted proxy.
 *
 *   AI_API_KEY       required — your provider key
 *   AI_API_BASE_URL  optional — default https://api.openai.com/v1
 *   AI_MODEL         optional — default gpt-4o-mini
 *   AI_VISION        optional — "false" to never send images to the model
 *
 * If AI_API_KEY is absent, Aura falls back to the Lovable gateway, and if that
 * is missing too, to a local filename heuristic (no network calls at all).
 */
const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL = "google/gemini-3.6-flash";

function resolveProvider() {
  const ownKey = process.env["AI_API_KEY"];
  if (ownKey) {
    const base = (process.env["AI_API_BASE_URL"] ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    return {
      url: `${base}/chat/completions`,
      apiKey: ownKey,
      model: process.env["AI_MODEL"] ?? "gpt-4o-mini",
      vision: process.env["AI_VISION"] !== "false",
      own: true,
    };
  }
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (lovableKey) {
    return {
      url: LOVABLE_GATEWAY,
      apiKey: lovableKey,
      model: LOVABLE_MODEL,
      vision: true,
      own: false,
    };
  }
  return null;
}


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
  const provider = resolveProvider();
  if (!provider) return heuristic(input.fileName);


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
  if (input.imageBase64 && provider.vision) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${input.imageBase64}` },
    });
  }

  const res = await fetch(provider.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const message = await res.text();
    console.error(`AI provider error ${res.status}`, message.slice(0, 500));
    if (res.status === 401 || res.status === 403)
      throw new Error("Your AI provider rejected the API key. Check AI_API_KEY.");
    if (res.status === 404)
      throw new Error("AI endpoint not found. Check AI_API_BASE_URL and AI_MODEL.");
    if (res.status === 429) throw new Error("Your AI provider is rate limiting — try again shortly.");
    if (res.status === 402)
      throw new Error("Your AI provider reports insufficient credits.");
    throw new Error(`AI analysis failed (${res.status}).`);
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
