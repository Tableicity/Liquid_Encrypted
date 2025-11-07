import { Shield, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import aiAvatarImg from "@assets/generated_images/AI_security_avatar_icon_ea127ca5.png";

interface ChatMessageProps {
  role: "ai" | "user";
  content: string;
  timestamp?: string;
}

export function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isAI = role === "ai";

  return (
    <div
      className={`flex gap-3 mb-4 animate-slide-in ${isAI ? "" : "flex-row-reverse"}`}
      data-testid={`message-${role}`}
    >
      <Avatar className="w-8 h-8 mt-1">
        {isAI ? (
          <>
            <AvatarImage src={aiAvatarImg} alt="AI" />
            <AvatarFallback className="bg-primary/10">
              <Shield className="w-4 h-4 text-primary" />
            </AvatarFallback>
          </>
        ) : (
          <AvatarFallback className="bg-secondary">
            <User className="w-4 h-4" />
          </AvatarFallback>
        )}
      </Avatar>

      <div className={`flex-1 max-w-[80%] ${isAI ? "" : "flex flex-col items-end"}`}>
        <div
          className={`rounded-md px-4 py-3 ${
            isAI
              ? "bg-card border border-card-border"
              : "bg-primary text-primary-foreground"
          }`}
        >
          <p className="text-sm leading-relaxed">{content}</p>
        </div>
        {timestamp && (
          <p className="text-xs text-muted-foreground mt-1 px-1">{timestamp}</p>
        )}
      </div>
    </div>
  );
}
