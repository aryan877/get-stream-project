import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ArrowRight, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

export interface ChatInputProps {
  className?: string;
  sendMessage: (message: { text: string }) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  value: string;
  onValueChange: (text: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  className,
  sendMessage,
  disabled,
  placeholder = "Ask me to write something, or paste text to improve...",
  value,
  onValueChange,
  textareaRef: externalTextareaRef,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalTextareaRef || internalTextareaRef;

  // Auto-resize textarea
  const updateTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 120; // ~6 lines
      const textareaHeight = Math.min(scrollHeight, maxHeight);
      textarea.style.height = `${textareaHeight}px`;
    }
  }, [textareaRef]);

  // Auto-resize textarea
  useEffect(() => {
    updateTextareaHeight();
  }, [value, updateTextareaHeight]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || isLoading || !sendMessage) return;

    setIsLoading(true);
    try {
      await sendMessage({
        text: value.trim(),
      });
      onValueChange("");
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

  return (
    <div className={cn("p-4", className)}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              "min-h-[44px] max-h-[120px] resize-none py-3 pl-4 pr-20 text-sm",
              "border-input focus:border-primary/50 rounded-lg",
              "transition-colors duration-200 bg-background"
            )}
            disabled={isLoading || disabled}
          />

          {/* Clear button */}
          {value.trim() && !isLoading && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onValueChange("")}
              className="absolute right-12 bottom-2 h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
              title="Clear text"
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          {/* Send Button inside textarea */}
          <Button
            type="submit"
            disabled={!value.trim() || isLoading || disabled}
            className={cn(
              "absolute right-2 bottom-2 h-8 w-8 rounded-md flex-shrink-0 p-0",
              "transition-all duration-200",
              "disabled:opacity-30 disabled:cursor-not-allowed",
              !value.trim() ? "bg-muted hover:bg-muted" : ""
            )}
            variant={value.trim() ? "default" : "ghost"}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};
