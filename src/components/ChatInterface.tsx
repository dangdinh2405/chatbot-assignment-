import { useState, useEffect } from "react";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { UserSetup } from "./UserSetup";
import { ConversationList } from "./ConversationList";
import { useChat } from "@/hooks/useChat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const [conversations, setConversations] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const storedUserId = localStorage.getItem("chatUserId");
    const storedUserName = localStorage.getItem("chatUserName");
    
    if (storedUserId && storedUserName) {
      setUserId(storedUserId);
      setUserName(storedUserName);
      loadUserConversations(storedUserId);
    }
  }, []);



  const loadUserConversations = async (uId: string) => {
    try {
      const { data: userConvs, error: convErr } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", uId)
        .order("created_at", { ascending: false });

      if (convErr) throw convErr;

      if (userConvs && userConvs.length > 0) {
        setConversations(userConvs);
        setConversationId(userConvs[0].id);
      } else {
        await createNewConversation(uId);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách cuộc trò chuyện",
        variant: "destructive",
      });
    }
  };

  const createNewConversation = async (uId: string) => {
    try {
      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({
          title: `Cuộc trò chuyện ${new Date().toLocaleString("vi-VN")}`,
          user_id: uId,
        })
        .select()
        .single();

      if (error) throw error;

      setConversations((prev) => [newConv, ...prev]);
      setConversationId(newConv.id);

      toast({ title: "Đã tạo cuộc trò chuyện mới" });
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tạo cuộc trò chuyện mới",
        variant: "destructive",
      });
    }
  };

  const handleUserSetup = async (uId: string, uName: string) => {
    setUserId(uId);
    setUserName(uName);
    await loadUserConversations(uId);
  };

  const handleLogout = () => {
    localStorage.removeItem("chatUserId");
    localStorage.removeItem("chatUserName");
    setUserId(null);
    setUserName(null);
    setConversationId(null);
    setConversations([]);
    toast({
      title: "Đã đăng xuất",
    });
  };

  const handleNewConversation = () => {
    if (userId) {
      createNewConversation(userId);
    }
  };

  const handleSelectConversation = (id: string) => {
    setConversationId(id);
  };

  const { messages, isLoading, sendMessage } = useChat(conversationId || undefined, userId || undefined);

  if (!userId || !userName) {
    return <UserSetup onUserSetup={handleUserSetup} />;
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-background to-secondary/20">
      <div className="w-64 flex-shrink-0">
        <ConversationList
          conversations={conversations}
          currentConversationId={conversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
        />
      </div>

      <div className="flex-1 flex flex-col">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Chatbot
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Xin chào, {userName}
              </p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Đăng xuất
            </Button>
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
    </div>
  );
};
