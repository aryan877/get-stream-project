import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bot, Check, Copy } from "lucide-react";
import React, { useState } from "react";
import {
  useAIState,
  useChannelStateContext,
  useMessageContext,
  useMessageTextStreaming,
} from "stream-chat-react";

export const MessageListEmptyStateIndicator = () => (
  <div className="flex h-full w-full items-center justify-center">
    <div className="text-center">
      <Bot className="h-12 w-12 mx-auto text-muted-foreground/50" />
      <h2 className="mt-4 text-lg font-medium text-foreground">
        No Messages Yet
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Be the first one to send a message!
      </p>
    </div>
  </div>
);

const ChatMessage: React.FC = () => {
  const { message } = useMessageContext();
  const { channel } = useChannelStateContext();
  const { aiState } = useAIState(channel);

  const { streamedMessageText } = useMessageTextStreaming({
    text: message.text ?? "",
    renderingLetterCount: 10,
    streamingLetterIntervalMs: 50,
  });

  const isUser = !message.user?.id?.startsWith("ai-bot");
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    if (streamedMessageText) {
      await navigator.clipboard.writeText(streamedMessageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getAiStateMessage = () => {
    switch (aiState) {
      case "AI_STATE_THINKING":
        return "Thinking...";
      case "AI_STATE_GENERATING":
        return "Generating response...";
      case "AI_STATE_EXTERNAL_SOURCES":
        return "Accessing external sources...";
      case "AI_STATE_ERROR":
        return "An error occurred.";
      default:
        return null;
    }
  };

  const formatTime = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      className={cn(
        "flex w-full mb-4 px-4 group",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "flex max-w-[70%] sm:max-w-[60%] lg:max-w-[50%]",
          isUser ? "flex-row-reverse" : "flex-row"
        )}
      >
        {/* Avatar */}
        {!isUser && (
          <div className="flex-shrink-0 mr-3 self-end">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-muted text-muted-foreground">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        {/* Message Content */}
        <div className="flex flex-col space-y-1">
          {/* Message Bubble */}
          <div
            className={cn(
              "px-4 py-3 rounded-2xl text-sm leading-relaxed transition-all duration-200",
              isUser
                ? "bg-primary text-primary-foreground rounded-br-md message-user"
                : "bg-muted text-muted-foreground rounded-bl-md message-bot"
            )}
          >
            {/* Message Text */}
            <div className="whitespace-pre-wrap break-words">
              {streamedMessageText || message.text}
            </div>

            {/* Loading State */}
            {(message.generating || aiState) &&
              !streamedMessageText &&
              !message.text && (
                <div className="flex items-center gap-2 mt-2 pt-2">
                  <span className="text-xs opacity-70">
                    {getAiStateMessage()}
                  </span>
                  <div className="flex space-x-1">
                    <div className="w-1 h-1 bg-current rounded-full typing-dot opacity-70"></div>
                    <div className="w-1 h-1 bg-current rounded-full typing-dot opacity-70"></div>
                    <div className="w-1 h-1 bg-current rounded-full typing-dot opacity-70"></div>
                  </div>
                </div>
              )}
          </div>

          {/* Timestamp and Actions */}
          <div className="flex items-center justify-between px-1">
            {/* Timestamp - Always left aligned */}
            <span className="text-xs text-muted-foreground/70">
              {formatTime(message.created_at || new Date())}
            </span>

            {/* Actions - Only for AI messages, always right aligned */}
            {!isUser && !!streamedMessageText && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyToClipboard}
                  className="h-6 px-2 text-xs hover:bg-muted rounded-md"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-green-600" />
                      <span className="text-green-600">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
