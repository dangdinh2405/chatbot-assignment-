import ReactMarkdown from "react-markdown";
import { User, Bot } from "lucide-react";
import type { Message } from "./ChatInterface";
import { CSVPreview } from "./CSVPreview";

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-gradient-to-br from-primary to-accent"
            : "bg-secondary"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-foreground" />
        )}
      </div>

      <div className={`flex-1 max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-3 shadow-sm ${
            isUser
              ? "bg-gradient-to-br from-primary to-accent text-white"
              : "bg-card border border-border"
          }`}
        >
          {message.imageUrl && (
            <img
              src={message.imageUrl}
              alt="Uploaded"
              className="rounded-lg mb-2 max-w-sm w-full object-cover"
            />
          )}
          
          {message.csvData && message.csvFileName && (
            <CSVPreview csvData={message.csvData} fileName={message.csvFileName} />
          )}

          <div className={`prose prose-sm max-w-none ${isUser ? "prose-invert" : ""}`}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>

        <span className="text-xs text-muted-foreground mt-1 px-2">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
};
