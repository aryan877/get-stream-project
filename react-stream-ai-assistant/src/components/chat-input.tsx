import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

export interface ChatInputProps {
  className?: string;
  sendMessage: (message: { text: string }) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  className,
  sendMessage,
  disabled,
  placeholder = "Type a message...",
}) => {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update CSS custom property for input height
  const updateInputHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      const inputContainer = textarea.closest(".chat-input-container");
      if (inputContainer) {
        const containerHeight = inputContainer.getBoundingClientRect().height;
        document.documentElement.style.setProperty(
          "--message-input-height",
          `${containerHeight}px`
        );
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading || !sendMessage) return;

    setIsLoading(true);
    try {
      await sendMessage({
        text: message.trim(),
      });
      setMessage("");
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Set initial height on mount
  useEffect(() => {
    updateInputHeight();
  }, [updateInputHeight]);

  // Auto-resize textarea and update CSS custom property
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 120; // ~6 lines
      const textareaHeight = Math.min(scrollHeight, maxHeight);
      textarea.style.height = `${textareaHeight}px`;

      // Update the input height after resize
      setTimeout(updateInputHeight, 0);
    }
  }, [message, updateInputHeight]);

  return (
    <div className={cn("p-4 chat-input-container", className)}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              "min-h-[44px] max-h-[120px] resize-none py-3 pl-4 pr-12 text-sm",
              "border-input focus:border-primary/50 rounded-lg",
              "transition-colors duration-200 bg-background"
            )}
            disabled={isLoading || disabled}
          />

          {/* Send Button inside textarea */}
          <Button
            type="submit"
            disabled={!message.trim() || isLoading || disabled}
            className={cn(
              "absolute right-2 bottom-2 h-8 w-8 rounded-md flex-shrink-0 p-0",
              "transition-all duration-200",
              "disabled:opacity-30 disabled:cursor-not-allowed",
              !message.trim() ? "bg-muted hover:bg-muted" : ""
            )}
            variant={message.trim() ? "default" : "ghost"}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};
