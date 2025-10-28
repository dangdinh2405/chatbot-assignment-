import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

interface UserSetupProps {
  onUserSetup: (userId: string, userName: string) => void;
}

export const UserSetup = ({ onUserSetup }: UserSetupProps) => {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      const userId = crypto.randomUUID();
      localStorage.setItem("chatUserId", userId);
      localStorage.setItem("chatUserName", name.trim());
      onUserSetup(userId, name.trim());
    } catch (error) {
      console.error("Error setting up user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Chào mừng đến Multi-Modal Chat
          </CardTitle>
          <CardDescription>
            Nhập tên của bạn để bắt đầu trò chuyện
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Nhập tên của bạn..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || !name.trim()}>
              {isLoading ? "Đang thiết lập..." : "Bắt đầu chat"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
