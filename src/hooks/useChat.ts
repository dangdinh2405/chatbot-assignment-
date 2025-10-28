import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Message } from "@/components/ChatInterface";

export const useChat = (conversationId?: string, currentUserId?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Load conversation history
  useEffect(() => {
    if (conversationId) {
      loadConversationHistory(conversationId);
    }
  }, [conversationId]);

  const loadConversationHistory = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          chat_users (
            id,
            name
          )
        `)
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data) {
        const loadedMessages: Message[] = data.map((msg: any) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          timestamp: new Date(msg.created_at),
          imageUrl: msg.image_url || undefined,
          csvData: msg.csv_data || undefined,
          csvFileName: msg.csv_filename || undefined,
          userName: msg.chat_users?.name || undefined,
        }));
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải lịch sử trò chuyện",
        variant: "destructive",
      });
    }
  };

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
      const userName = localStorage.getItem("chatUserName") || "Anonymous";
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
        imageUrl: imageData,
        csvData,
        csvFileName,
        userName,
      };

      setMessages((prev) => [...prev, userMessage]);

      // Save user message to database
      if (conversationId && currentUserId) {
        try {
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            user_id: currentUserId,
            role: "user",
            content,
            image_url: imageData,
            csv_data: csvData,
            csv_filename: csvFileName,
          });
        } catch (err) {
          console.error("Error saving user message:", err);
        }
      }

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

      let assistantMessageId = assistantMessage.id;

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

      // Save assistant message to database
      if (conversationId && assistantContent) {
        try {
          await supabase.from("messages").insert({
            id: assistantMessageId,
            conversation_id: conversationId,
            user_id: null,
            role: "assistant",
            content: assistantContent,
          });
        } catch (err) {
          console.error("Error saving assistant message:", err);
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
