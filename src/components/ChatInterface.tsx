import { useState, useEffect } from "react";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { UserSetup } from "./UserSetup";
import { useChat } from "@/hooks/useChat";
import { supabase } from "@/integrations/supabase/client";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imageUrl?: string;
  csvData?: string;
  csvFileName?: string;
  userName?: string;
}

export const ChatInterface = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    const storedUserId = localStorage.getItem("chatUserId");
    const storedUserName = localStorage.getItem("chatUserName");
    
    if (storedUserId && storedUserName) {
      setUserId(storedUserId);
      setUserName(storedUserName);
      initializeConversation(storedUserId);
    }
  }, []);

  const initializeConversation = async (uId: string) => {
    try {
      // Create or get existing conversation
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingConv) {
        setConversationId(existingConv.id);
      } else {
        const { data: newConv, error } = await supabase
          .from("conversations")
          .insert({ title: "Cuộc trò chuyện mới" })
          .select()
          .single();

        if (error) throw error;
        setConversationId(newConv.id);
      }

      // Create or get user in database
      const { data: existingUser } = await supabase
        .from("chat_users")
        .select("id")
        .eq("id", uId)
        .maybeSingle();

      if (!existingUser) {
        await supabase.from("chat_users").insert({
          id: uId,
          name: localStorage.getItem("chatUserName") || "Anonymous",
        });
      }
    } catch (error) {
      console.error("Error initializing conversation:", error);
    }
  };

  const handleUserSetup = async (uId: string, uName: string) => {
    setUserId(uId);
    setUserName(uName);
    await initializeConversation(uId);
  };

  const { messages, isLoading, sendMessage } = useChat(conversationId || undefined, userId || undefined);

  if (!userId || !userName) {
    return <UserSetup onUserSetup={handleUserSetup} />;
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-background to-secondary/20">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Multi-Modal Chat
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chat with text, images, and CSV data
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <MessageList messages={messages} isLoading={isLoading} />
      </main>

      <footer className="border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <ChatInput onSendMessage={sendMessage} isLoading={isLoading} />
        </div>
      </footer>
    </div>
  );
};
