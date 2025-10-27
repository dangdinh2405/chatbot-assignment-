import { useState } from "react";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { useChat } from "@/hooks/useChat";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imageUrl?: string;
  csvData?: string;
  csvFileName?: string;
}

export const ChatInterface = () => {
  const { messages, isLoading, sendMessage } = useChat();

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
