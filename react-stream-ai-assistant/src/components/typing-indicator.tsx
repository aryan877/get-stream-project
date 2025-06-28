import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import React from "react";
import { useTypingContext } from "stream-chat-react";

export const TypingIndicator: React.FC = () => {
  const { typing } = useTypingContext();

  if (!typing || Object.keys(typing).length === 0) {
    return null;
  }

  const typingUsers = Object.values(typing);
  const aiBot = typingUsers.find(
    (user) => typeof user.id === "string" && user.id.startsWith("ai-bot")
  );

  if (!aiBot) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border">
      <Avatar className="w-8 h-8 border-2 border-primary/50">
        <AvatarImage src={typingUsers[0].user?.image} />
        <AvatarFallback>
          {typingUsers[0].user?.name || "AI Assistant"}
        </AvatarFallback>
      </Avatar>
      <div className="text-sm text-muted-foreground font-medium">
        {typingUsers[0].user?.name || "AI Assistant"} is typing
        <span className="animate-pulse">...</span>
      </div>
    </div>
  );
};
