import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Send, Image, FileText, Link as LinkIcon, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "./ui/input";

interface ChatInputProps {
  onSendMessage: (message: string, imageFile?: File, csvFile?: File, csvUrl?: string) => void;
  isLoading: boolean;
}

export const ChatInput = ({ onSendMessage, isLoading }: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUrl, setCsvUrl] = useState("");
  const [showCsvUrlInput, setShowCsvUrlInput] = useState(false);
  const { toast } = useToast();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Invalid file type",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select a CSV file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setCsvFile(file);
    setShowCsvUrlInput(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() && !imageFile && !csvFile && !csvUrl.trim()) {
      return;
    }

    onSendMessage(message, imageFile || undefined, csvFile || undefined, csvUrl || undefined);
    
    setMessage("");
    setImagePreview(null);
    setImageFile(null);
    setCsvFile(null);
    setCsvUrl("");
    setShowCsvUrlInput(false);
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageFile(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const clearCsv = () => {
    setCsvFile(null);
    if (csvInputRef.current) {
      csvInputRef.current.value = "";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {imagePreview && (
        <div className="relative inline-block">
          <img src={imagePreview} alt="Preview" className="h-20 rounded-lg" />
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
            onClick={clearImage}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {csvFile && (
        <div className="inline-flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg">
          <FileText className="w-4 h-4" />
          <span className="text-sm">{csvFile.name}</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-5 w-5 rounded-full"
            onClick={clearCsv}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {showCsvUrlInput && (
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="Enter CSV URL (e.g., GitHub raw link)"
            value={csvUrl}
            onChange={(e) => setCsvUrl(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              setShowCsvUrlInput(false);
              setCsvUrl("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1 flex gap-2 items-end">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message... (supports markdown)"
            className="min-h-[60px] max-h-[200px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => imageInputRef.current?.click()}
            disabled={isLoading}
            title="Upload image"
          >
            <Image className="h-4 w-4" />
          </Button>

          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={handleCsvSelect}
            className="hidden"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => csvInputRef.current?.click()}
            disabled={isLoading}
            title="Upload CSV"
          >
            <FileText className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setShowCsvUrlInput(!showCsvUrlInput)}
            disabled={isLoading}
            title="CSV from URL"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>

          <Button
            type="submit"
            size="icon"
            disabled={isLoading || (!message.trim() && !imageFile && !csvFile && !csvUrl.trim())}
            className="bg-gradient-to-br from-primary to-accent hover:opacity-90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </form>
  );
};
