import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { LogOut, Moon, PlusCircle, Sun, X } from "lucide-react";
import { useChatContext } from "stream-chat-react";
import { useTheme } from "../hooks/use-theme";

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onNewChat: () => void;
  children: React.ReactNode;
}

export const ChatSidebar = ({
  isOpen,
  onClose,
  onLogout,
  onNewChat,
  children,
}: ChatSidebarProps) => {
  const { client } = useChatContext();
  const { user } = client;
  const { theme, setTheme } = useTheme();

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* The Sidebar */}
      <div
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-80 bg-background border-r flex flex-col transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Writing Sessions</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="lg:hidden h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Channel List */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-1">{children}</div>
        </ScrollArea>

        {/* New Chat Button */}
        <div className="p-2 border-t">
          <Button onClick={onNewChat} className="w-full justify-start">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Writing Session
          </Button>
        </div>

        {/* User Profile / Logout */}
        <div className="p-2 border-t bg-background">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start items-center p-2 h-auto"
              >
                <Avatar className="w-8 h-8 mr-2">
                  <AvatarImage src={user?.image} alt={user?.name} />
                  <AvatarFallback>
                    {user?.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">Online</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72" align="end">
              <DropdownMenuItem
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                <span>
                  Switch to {theme === "dark" ? "Light" : "Dark"} Theme
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
};
