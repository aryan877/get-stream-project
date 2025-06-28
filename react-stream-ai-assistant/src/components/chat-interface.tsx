import { useAIAgentStatus } from "@/hooks/use-ai-agent-status";
import { Bot, Menu } from "lucide-react";
import { useRef, useState } from "react";
import {
  Channel,
  MessageList,
  useChannelActionContext,
  useChannelStateContext,
  useChatContext,
  Window,
} from "stream-chat-react";
import { AIAgentControl } from "./ai-agent-control";
import { ChatInput, ChatInputProps } from "./chat-input";
import ChatMessage from "./chat-message";
import { Button } from "./ui/button";
import { WritingPromptsToolbar } from "./writing-prompts-toolbar";

interface ChatInterfaceProps {
  onToggleSidebar: () => void;
  onNewChatMessage: (message: { text: string }) => Promise<void>;
  backendUrl: string;
}

const EmptyStateWithInput: React.FC<{
  onNewChatMessage: ChatInputProps["sendMessage"];
}> = ({ onNewChatMessage }) => {
  const [inputText, setInputText] = useState("");
  const writingPrompts = [
    "Write a professional email to my boss",
    "Help me brainstorm ideas for a new project",
    "Improve this paragraph for clarity",
    "Create an outline for a blog post about AI",
    "Write a blog post about the future of work",
    "Draft a proposal for a new marketing campaign",
  ];

  const handlePromptClick = (prompt: string) => {
    setInputText(prompt);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center overflow-y-auto">
        <div className="text-center max-w-lg p-6">
          <Bot className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-medium text-foreground">
            Your AI Writing Assistant
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            I can help you write, edit, brainstorm, and improve any type of
            content.
          </p>
          <div className="mt-4 text-xs text-muted-foreground/70 space-y-1">
            <p>• Write articles, emails, stories, or any content</p>
            <p>• Edit and improve existing text</p>
            <p>• Brainstorm ideas and outlines</p>
            <p>• Adapt tone and style for your audience</p>
          </div>

          {/* Writing Prompt Suggestions */}
          <div className="mt-6">
            <p className="text-xs font-medium text-muted-foreground mb-3">
              Try these prompts:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {writingPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handlePromptClick(prompt)}
                  className="p-3 text-left rounded-md bg-muted/30 hover:bg-muted/50 transition-colors border border-muted/50 hover:border-muted"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="border-t bg-background">
        <ChatInput
          sendMessage={onNewChatMessage}
          placeholder="Tell me what you'd like to write, or paste text to improve..."
          value={inputText}
          onValueChange={setInputText}
          className="!p-4"
        />
      </div>
    </div>
  );
};

const ChannelMessageInput = () => {
  const { sendMessage } = useChannelActionContext();
  const [inputText, setInputText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePromptSelect = (prompt: string) => {
    // Append the prompt to existing text or set it if empty
    setInputText((prev) => (prev ? `${prev.trim()} ${prompt}` : prompt));
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col bg-background border-t">
      <WritingPromptsToolbar onPromptSelect={handlePromptSelect} />
      <ChatInput
        sendMessage={sendMessage}
        value={inputText}
        onValueChange={setInputText}
        textareaRef={textareaRef}
        className="!p-4"
      />
    </div>
  );
};

const MessageListContent = () => {
  const { messages, thread } = useChannelStateContext();
  const isThread = !!thread;

  if (isThread) return null;

  const MessageListEmptyIndicator = () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-center px-4">
        <Bot className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <h2 className="mt-4 text-lg font-medium text-foreground">
          Ready to Write
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          There are no messages yet. Start the conversation!
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 min-h-0">
      {!messages?.length ? (
        <MessageListEmptyIndicator />
      ) : (
        <MessageList Message={ChatMessage} />
      )}
    </div>
  );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onToggleSidebar,
  onNewChatMessage,
  backendUrl,
}) => {
  const { channel } = useChatContext();
  const agentStatus = useAIAgentStatus({
    channelId: channel?.id ?? null,
    backendUrl,
  });

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b bg-background z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="lg:hidden h-9 w-9"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {channel?.data?.name || "New Writing Session"}
              </h2>
              <p className="text-xs text-muted-foreground">
                AI Writing Assistant
              </p>
            </div>
          </div>
        </div>
        {channel?.id && (
          <AIAgentControl
            status={agentStatus.status}
            loading={agentStatus.loading}
            error={agentStatus.error}
            toggleAgent={agentStatus.toggleAgent}
            checkStatus={agentStatus.checkStatus}
            channelId={channel.id}
          />
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {!channel ? (
          <EmptyStateWithInput onNewChatMessage={onNewChatMessage} />
        ) : (
          <Channel channel={channel}>
            <Window>
              <MessageListContent />
              <ChannelMessageInput />
            </Window>
          </Channel>
        )}
      </div>
    </div>
  );
};
