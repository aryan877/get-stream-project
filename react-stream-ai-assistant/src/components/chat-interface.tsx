import { useAIAgentStatus } from "@/hooks/use-ai-agent-status";
import { Bot, Menu } from "lucide-react";
import {
  Channel,
  MessageList,
  useChannelActionContext,
  useChatContext,
} from "stream-chat-react";
import { AIAgentControl } from "./ai-agent-control";
import { ChatInput, ChatInputProps } from "./chat-input";
import ChatMessage, { MessageListEmptyStateIndicator } from "./chat-message";
import { TypingIndicator } from "./typing-indicator";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";

interface ChatInterfaceProps {
  onToggleSidebar: () => void;
  onNewChatMessage: (message: { text: string }) => Promise<void>;
  backendUrl: string;
}

const EmptyStateWithInput: React.FC<{
  onNewChatMessage: ChatInputProps["sendMessage"];
}> = ({ onNewChatMessage }) => (
  <div className="flex flex-col h-full">
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <Bot className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <h2 className="mt-4 text-lg font-medium text-foreground">
          Your AI Assistant
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Start a conversation by typing your message below.
        </p>
      </div>
    </div>
    <div className="p-4 border-t">
      <ChatInput
        sendMessage={onNewChatMessage}
        placeholder="Start a new chat with the AI assistant..."
      />
    </div>
  </div>
);

const ChannelMessageInput = () => {
  const { sendMessage } = useChannelActionContext();
  return <ChatInput sendMessage={sendMessage} />;
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
    <div className="flex flex-col h-screen bg-background">
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
                {channel?.data?.name || "New Chat"}
              </h2>
              <p className="text-xs text-muted-foreground">Writing Assistant</p>
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
      <div className="flex-1 relative">
        {!channel ? (
          <EmptyStateWithInput onNewChatMessage={onNewChatMessage} />
        ) : (
          <Channel channel={channel}>
            {channel.data?.member_count === 1 ? (
              <MessageListEmptyStateIndicator />
            ) : (
              <div
                className="absolute inset-0"
                style={{ bottom: "var(--message-input-height, 76px)" }}
              >
                <ScrollArea className="h-full">
                  <div className="pt-4 pb-4">
                    <MessageList
                      Message={ChatMessage}
                      hideDeletedMessages={true}
                      disableDateSeparator={true}
                    />
                    <div className="px-4 pb-2">
                      <TypingIndicator />
                    </div>
                  </div>
                </ScrollArea>
              </div>
            )}
            <div
              className="absolute bottom-0 left-0 right-0 border-t bg-background z-10"
              style={{ height: "var(--message-input-height, 76px)" }}
            >
              <ChannelMessageInput />
            </div>
          </Channel>
        )}
      </div>
    </div>
  );
};
