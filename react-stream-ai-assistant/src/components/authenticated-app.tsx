import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  Loader2,
  MessageCircle,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Channel, ChannelFilters, ChannelSort, User } from "stream-chat";
import { ChannelList, useChatContext } from "stream-chat-react";
import { v4 as uuidv4 } from "uuid";
import { ChatProvider } from "../providers/chat-provider";
import { ChatInterface } from "./chat-interface";
import { ChatSidebar } from "./chat-sidebar";
import { Button } from "./ui/button";

interface AuthenticatedAppProps {
  user: User;
  onLogout: () => void;
}

const ChannelListEmptyStateIndicator = () => (
  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
    <div className="mb-4">
      <div className="w-16 h-16 bg-gradient-to-br from-primary/15 via-primary/8 to-transparent rounded-2xl flex items-center justify-center shadow-sm border border-primary/10">
        <MessageCircle className="h-8 w-8 text-primary/70" />
      </div>
    </div>
    <div className="space-y-2 max-w-xs">
      <h3 className="text-sm font-medium text-foreground">
        No conversations yet
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Start a new chat to begin conversing with your AI assistant.
      </p>
    </div>
    <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground/60">
      <Plus className="h-3 w-3" />
      <span>Click "New Chat" to get started</span>
    </div>
  </div>
);

export const AuthenticatedApp = ({ user, onLogout }: AuthenticatedAppProps) => (
  <ChatProvider user={user}>
    <AuthenticatedCore user={user} onLogout={onLogout} />
  </ChatProvider>
);

const AuthenticatedCore = ({ user, onLogout }: AuthenticatedAppProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const { client, setActiveChannel } = useChatContext();
  const navigate = useNavigate();
  const { channelId } = useParams<{ channelId: string }>();
  const backendUrl = import.meta.env.VITE_BACKEND_URL as string;

  useEffect(() => {
    const syncChannelWithUrl = async () => {
      if (!client) return;

      if (channelId) {
        const channel = client.channel("messaging", channelId);
        await channel.watch();
        setActiveChannel(channel);
      } else {
        setActiveChannel(undefined);
      }
    };
    syncChannelWithUrl();
  }, [channelId, client, setActiveChannel]);

  const handleNewChatMessage = async (message: { text: string }) => {
    if (!user.id) return;

    try {
      // 1. Create a new channel with the user as the only member
      const newChannel = client.channel("messaging", uuidv4(), {
        name: message.text.substring(0, 50),
        members: [user.id],
      });
      await newChannel.watch();

      // 2. Set up event listener for when AI agent is added as member
      const memberAddedPromise = new Promise<void>((resolve) => {
        const unsubscribe = newChannel.on("member.added", (event) => {
          // Check if the added member is the AI agent (not the current user)
          if (event.member?.user?.id && event.member.user.id !== user.id) {
            unsubscribe.unsubscribe();
            resolve();
          }
        });
      });

      // 3. Connect the AI agent
      const response = await fetch(`${backendUrl}/start-ai-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_id: newChannel.id,
          channel_type: "messaging",
        }),
      });

      if (!response.ok) {
        throw new Error("AI agent failed to join the chat.");
      }

      // 4. Set the channel as active and navigate
      setActiveChannel(newChannel);
      navigate(`/chat/${newChannel.id}`);

      // 5. Wait for AI agent to be added as member, then send message
      await memberAddedPromise;
      await newChannel.sendMessage(message);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Something went wrong";
      console.error("Error creating new chat:", errorMessage);
    }
  };

  const handleNewChatClick = () => {
    setActiveChannel(undefined);
    navigate("/");
    setSidebarOpen(false);
  };

  const handleDeleteClick = (channel: Channel) => {
    setChannelToDelete(channel);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (channelToDelete) {
      try {
        if (channelId === channelToDelete.id) {
          navigate("/");
        }
        await channelToDelete.delete();
      } catch (error) {
        console.error("Error deleting channel:", error);
      }
    }
    setShowDeleteDialog(false);
    setChannelToDelete(null);
  };

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false);
    setChannelToDelete(null);
  };

  if (!client) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">
          Connecting to chat...
        </p>
      </div>
    );
  }

  const filters: ChannelFilters = {
    type: "messaging",
    members: { $in: [user.id] },
  };
  const sort: ChannelSort = { last_message_at: -1 };
  const options = { state: true, presence: true, limit: 10 };

  return (
    <div className="flex h-full w-full">
      <ChatSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={onLogout}
        onNewChat={handleNewChatClick}
      >
        <ChannelList
          filters={filters}
          sort={sort}
          options={options}
          EmptyStateIndicator={ChannelListEmptyStateIndicator}
          Preview={(previewProps) => (
            <div
              className={cn(
                "flex items-center p-2 rounded-lg cursor-pointer transition-colors relative group",
                previewProps.active
                  ? "bg-primary/20 text-primary-foreground"
                  : "hover:bg-muted/50"
              )}
              onClick={() => {
                if (previewProps.setActiveChannel) {
                  previewProps.setActiveChannel(previewProps.channel);
                }
                navigate(`/chat/${previewProps.channel.id}`);
                setSidebarOpen(false);
              }}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              <span className="flex-1 truncate text-sm font-medium">
                {previewProps.channel.data?.name || "New Chat"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={async (e) => {
                  e.stopPropagation();
                  handleDeleteClick(previewProps.channel);
                }}
                title="Delete chat"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground/70 hover:text-destructive" />
              </Button>
            </div>
          )}
        />
      </ChatSidebar>
      <div className="flex-1 flex flex-col min-w-0">
        <ChatInterface
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onNewChatMessage={handleNewChatMessage}
          backendUrl={backendUrl}
        />
      </div>

      {/* Delete Chat Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this chat? This action cannot be
              undone and all messages will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete Chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
