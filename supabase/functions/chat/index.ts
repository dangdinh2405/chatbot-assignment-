import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing chat request with:", {
      messageCount: messages.length,
      hasImage: !!imageData,
      hasCSV: !!csvData,
    });

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

    // If there's an image, add it to the last user message
    if (imageData && apiMessages.length > 0) {
      const lastUserMessageIndex = apiMessages.length - 1;
      const lastMessage = apiMessages[lastUserMessageIndex];
      
      if (lastMessage.role === "user") {
        apiMessages[lastUserMessageIndex] = {
          role: "user",
          content: [
            { type: "text", text: typeof lastMessage.content === "string" ? lastMessage.content : "" },
            { type: "image_url", image_url: { url: imageData } },
          ],
        };
      }
    }

    console.log("Making request to Lovable AI with", apiMessages.length, "messages");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a helpful AI assistant. When analyzing CSV data, provide clear insights, statistics, and visualizations descriptions. When analyzing images, describe what you see in detail. Always be concise and helpful.",
          },
          ...apiMessages,
        ],
        stream: true,
      }),
    });

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

    return new Response(response.body, {
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
