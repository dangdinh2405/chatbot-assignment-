import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } | string }>;
}

interface ChatRequest {
  messages: Message[];
  imageData?: string;
  csvData?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, imageData, csvData }: ChatRequest = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    console.log("Processing chat request with:", {
      messageCount: messages.length,
      hasImage: !!imageData,
      hasCSV: !!csvData,
    });

    // Helper: upload data URL image to Supabase Storage (bucket name: "images", public)
    async function uploadImageToSupabase(dataUrl: string): Promise<string | null> {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
          console.warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — skipping upload");
          return null;
        }

        const m = dataUrl.match(/^data:(image\/[a-zA-Z.+-]+);base64,(.*)$/);
        if (!m) {
          console.warn("Image is not a base64 data URL");
          return null;
        }
        const mime = m[1];
        const b64 = m[2];
        // decode base64
        const raw = atob(b64);
        const u8 = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);

        const ext = mime.split("/")[1].split("+")[0] || "png";
        const filename = `${crypto.randomUUID()}.${ext}`;
        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/images/${filename}`;

        const res = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": mime,
            "x-upsert": "false",
          },
          body: u8,
        });

        if (!res.ok) {
          console.error("Supabase upload failed:", res.status, await res.text());
          return null;
        }

        // public URL for objects in public bucket "images"
        return `${SUPABASE_URL}/storage/v1/object/public/images/${filename}`;
      } catch (e) {
        console.error("uploadImageToSupabase error:", e);
        return null;
      }
    }

    // Prepare the messages for the API
    const apiMessages: Message[] = [...messages];

    // If there's CSV data, add context to the system message
    if (csvData) {
      const systemMessage = {
        role: "assistant" as const,
        content: `I have access to CSV data. Here's the data:\n\`\`\`csv\n${csvData}\n\`\`\`\n\nI can help analyze this data, provide statistics, summaries, or answer questions about it.`,
      };
      apiMessages.unshift(systemMessage);
    }

    // If there's an image dataURL, try to upload and replace with public URL
    let effectiveImageUrl: string | undefined = undefined;
    if (imageData) {
      const uploaded = await uploadImageToSupabase(imageData);
      if (uploaded) {
        effectiveImageUrl = uploaded;
        console.log("Uploaded image to Supabase:", uploaded);
      } else {
        // fallback: send original data URL (may or may not be usable by Gemini)
        effectiveImageUrl = imageData;
        console.log("Using original data URL for image (no upload)");
      }

      // attach image to last user message (if exists)
      if (apiMessages.length > 0) {
        const lastIdx = apiMessages.length - 1;
        const last = apiMessages[lastIdx];
        if (last.role === "user") {
          apiMessages[lastIdx] = {
            role: "user",
            content: [
              { type: "text", text: typeof last.content === "string" ? last.content : "" },
              { type: "image_url", image_url: { url: imageData } },
            ],
          };
        }
      }
    }

    console.log("Making request to Lovable AI with", apiMessages.length, "messages");

    // Build contents for Gemini: preserve image parts as image entries so model can fetch
    const contents = [
      {
        role: "user",
        parts: [
          {
            text: "You are a helpful AI assistant. When analyzing CSV data, provide clear insights, statistics, and visualizations descriptions. When analyzing images, describe what you see in detail. Always be concise and helpful.",
          },
          ...apiMessages.map((m) => {
            if (typeof m.content === "string") {
              return { text: m.content };
            } else if (Array.isArray(m.content)) {
              return m.content.map((part) => {
                if (part.type === "text") {
                  return { text: part.text || "" };
                } else if (part.type === "image_url") {
                  const imageUrl = typeof part.image_url === "string"
                    ? part.image_url
                    : part.image_url?.url || "";
                  return { image: { imageUri: imageUrl } };
                }
                return { text: "" };
              });
            }
            return { text: "" };
          }).flat(),
        ],
      },
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const upstream = response.body;
    const contentType = response.headers.get("content-type") || "";

    // helper: walk object and collect text pieces commonly used by generative language responses
    function extractText(obj: any): string {
      if (obj == null) return "";
      if (typeof obj === "string") return obj;
      if (typeof obj === "number" || typeof obj === "boolean") return String(obj);

      if (Array.isArray(obj)) return obj.map(extractText).join("");

      if (typeof obj === "object") {
        if (Array.isArray((obj as any).choices)) {
          let out = "";
          for (const c of (obj as any).choices) {
            if (c?.delta?.content) out += String(c.delta.content);
            else if (c?.message?.content) out += extractText(c.message.content);
            else if (c?.text) out += String(c.text);
          }
          if (out) return out;
        }

        if (Array.isArray((obj as any).candidates)) {
          for (const cand of (obj as any).candidates) {
            if (cand?.content?.parts && Array.isArray(cand.content.parts)) {
              return cand.content.parts.map((p: any) => p?.text ?? "").join("");
            }
            if (cand?.output?.content) return extractText(cand.output.content);
          }
        }

        if ((obj as any).output && (obj as any).output.content) {
          return extractText((obj as any).output.content);
        }
        if ((obj as any).content) {
          const c = (obj as any).content;
          if (Array.isArray(c)) return c.map((p: any) => p?.text ?? "").join("");
          if (typeof c === "string") return c;
        }

        if (Array.isArray((obj as any).parts)) {
          return (obj as any).parts.map((p: any) => p?.text ?? "").join("");
        }

        if ((obj as any).delta && typeof (obj as any).delta.content === "string") {
          return (obj as any).delta.content;
        }

        return "";
      }

      return "";
    }

    // sanitize extracted text from backend metadata/id tokens
    function sanitizeText(s: string): string {
      if (!s) return "";
      s = s.replace(/model[^ \n\r]*/gi, "");
      s = s.replace(/TEXT\d+/gi, "");
      s = s.replace(/\bSTOP\b/gi, "");
      s = s.replace(/[_A-Za-z0-9-]{16,}/g, "");
      s = s.replace(/\s{2,}/g, " ").trim();
      return s;
    }

    // Build an SSE ReadableStream from either a streamed upstream or a complete JSON body
    const sseStream = new ReadableStream({
      async start(controller) {
        try {
          if (contentType.includes("application/json") && (!upstream || response.headers.get("transfer-encoding") === null)) {
            const json = await response.json();
            const pieces: string[] = [];

            if (Array.isArray(json)) {
              for (const item of json) {
                const t = extractText(item).trim();
                if (t) pieces.push(sanitizeText(t));
              }
            } else {
              const t = extractText(json).trim();
              if (t) pieces.push(sanitizeText(t));
            }

            for (const p of pieces) {
              const payload = { choices: [{ delta: { content: p } }] };
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`));
            }

            controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
            controller.close();
            return;
          }

          if (!upstream) throw new Error("No upstream response body");

          const reader = upstream.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? "";

            for (const raw of lines) {
              const line = raw.trim();
              if (!line) continue;

              let extracted = "";
              try {
                const parsed = JSON.parse(line);
                extracted = extractText(parsed).trim();
                extracted = sanitizeText(extracted);
              } catch {
                extracted = sanitizeText(line);
              }

              if (!extracted) continue;
              const payload = { choices: [{ delta: { content: extracted } }] };
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`));
            }
          }

          if (buffer.trim()) {
            let extracted = "";
            try {
              const parsed = JSON.parse(buffer);
              extracted = extractText(parsed).trim();
              extracted = sanitizeText(extracted);
            } catch {
              extracted = sanitizeText(buffer.trim());
            }
            if (extracted) {
              const payload = { choices: [{ delta: { content: extracted } }] };
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`));
            }
          }

          controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(sseStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
