import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Message } from "@/components/ChatInterface";

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const sendMessage = async (
    content: string,
    imageFile?: File,
    csvFile?: File,
    csvUrl?: string
  ) => {
    try {
      setIsLoading(true);

      let imageData: string | undefined;
      let csvData: string | undefined;
      let csvFileName: string | undefined;

      // Handle image upload
      if (imageFile) {
        const reader = new FileReader();
        imageData = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imageFile);
        });
      }

      // Handle CSV upload or URL
      if (csvFile) {
        const reader = new FileReader();
        csvData = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsText(csvFile);
        });
        csvFileName = csvFile.name;
      } else if (csvUrl) {
        try {
          const response = await fetch(csvUrl);
          if (!response.ok) throw new Error("Failed to fetch CSV");
          csvData = await response.text();
          csvFileName = new URL(csvUrl).pathname.split("/").pop() || "data.csv";
        } catch (error) {
          toast({
            title: "Failed to load CSV",
            description: "Could not fetch CSV from the provided URL",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      // Create user message
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
        imageUrl: imageData,
        csvData,
        csvFileName,
      };

      setMessages((prev) => [...prev, userMessage]);

      // Prepare messages for API
      const apiMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      apiMessages.push({
        role: "user",
        content,
      });

      // Call chat API
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: apiMessages,
            imageData,
            csvData,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get response");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      // Stream the response (robust SSE parsing)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // helper: recursively collect strings from various possible response shapes
      function collectText(obj: any): string {
        if (obj == null) return "";
        if (typeof obj === "string") return obj;
        if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
        if (Array.isArray(obj)) return obj.map(collectText).join("");
        if (typeof obj === "object") {
          // common quick picks
          if (typeof obj === "object" && typeof obj.text === "string") return obj.text;
          if (obj.delta && typeof obj.delta.content === "string") return obj.delta.content;
          if (obj.choices && Array.isArray(obj.choices)) {
            for (const c of obj.choices) {
              // try delta.content or message/content parts
              if (c.delta && typeof c.delta.content === "string") return c.delta.content;
              if (c.message && c.message.content) return collectText(c.message.content);
              if (c.text) return String(c.text);
            }
          }
          if (obj.output && obj.output.content) return collectText(obj.output.content);
          if (obj.candidates && Array.isArray(obj.candidates)) return obj.candidates.map(collectText).join("");
          if (obj.parts && Array.isArray(obj.parts)) return obj.parts.map((p: any) => p.text ?? "").join("");
          // fallback: traverse keys
          let out = "";
          for (const k of Object.keys(obj)) {
            out += collectText(obj[k]);
          }
          return out;
        }
        return "";
      }

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by a blank line -> split by \n\n (handle \r\n too)
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || "";

        for (const ev of events) {
          if (!ev.trim()) continue;

          // collect data: lines (can be multiple data: lines per event)
          const dataLines = ev
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.replace(/^data:\s?/, ""));

          if (dataLines.length === 0) continue;

          const dataStr = dataLines.join("\n").trim();
          if (!dataStr || dataStr === "[DONE]") continue;

          let extracted = "";
          try {
            const parsed = JSON.parse(dataStr);
            extracted = collectText(parsed).trim();
          } catch (e) {
            // not JSON, treat as plain text
            extracted = dataStr;
          }

          if (!extracted) continue;

          assistantContent += extracted;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id ? { ...msg, content: assistantContent } : msg
            )
          );
        }
      }

      // flush any remaining buffer (in case no trailing double newline)
      if (buffer.trim()) {
        const dataStr = buffer.trim();
        if (dataStr !== "[DONE]") {
          let extracted = "";
          try {
            const parsed = JSON.parse(dataStr);
            extracted = collectText(parsed).trim();
          } catch {
            extracted = dataStr;
          }
          if (extracted) {
            assistantContent += extracted;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id ? { ...msg, content: assistantContent } : msg
              )
            );
          }
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Chat error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return {
    messages,
    isLoading,
    sendMessage,
  };
};
