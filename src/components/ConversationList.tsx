import { MessageSquare, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export const ConversationList = ({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationListProps) => {
  return (
    <div className="flex flex-col h-full border-r border-border bg-card/30">
      <div className="p-4 border-b border-border">
        <Button
          onClick={onNewConversation}
          className="w-full"
          variant="outline"
        >
          <Plus className="mr-2 h-4 w-4" />
          Cuộc trò chuyện mới
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors flex items-start gap-2 ${
                currentConversationId === conv.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-accent/50 text-foreground"
              }`}
            >
              <MessageSquare className="h-4 w-4 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{conv.title}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(conv.created_at).toLocaleDateString("vi-VN")}
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
