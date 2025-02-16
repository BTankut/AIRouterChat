import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, StopCircle, Bot, User, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { streamChat } from "@/lib/openrouter";
import { apiRequest } from "@/lib/queryClient";
import type { Message, Settings } from "@shared/schema";

export function ChatInterface() {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortController = useRef<AbortController>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentAssistantMessageId = useRef<number | null>(null);

  const settings = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const messages = useQuery<Message[]>({
    queryKey: ["/api/messages"],
  });

  const addMessage = useMutation({
    mutationFn: async (message: { role: string; content: string; id?: number }) => {
      const response = await apiRequest("POST", "/api/messages", {
        ...message,
        timestamp: new Date().toISOString(),
      });
      const data = await response.json();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  const clearMessages = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/messages/clear");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.data]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    if (!settings.data?.selectedModel) {
      toast({
        title: "Error",
        description: "Please select a model in settings",
        variant: "destructive",
      });
      return;
    }

    const userMessage = { role: "user", content: input };
    await addMessage.mutateAsync(userMessage);
    setInput("");

    try {
      setIsStreaming(true);
      abortController.current = new AbortController();

      const assistantMessage = {
        role: "assistant",
        content: "",
      };

      const initialResponse = await addMessage.mutateAsync(assistantMessage);
      currentAssistantMessageId.current = initialResponse.id;
      const currentMessages = messages.data || [];

      let streamContent = "";
      for await (const chunk of streamChat(
        settings.data.selectedModel,
        [...currentMessages, userMessage],
        abortController.current.signal
      )) {
        streamContent += chunk;
        if (currentAssistantMessageId.current !== null) {
          await addMessage.mutateAsync({
            role: "assistant",
            content: streamContent,
            id: currentAssistantMessageId.current
          });
        }
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        toast({
          title: "Error",
          description: "Failed to generate response",
          variant: "destructive",
        });
      }
    } finally {
      setIsStreaming(false);
      currentAssistantMessageId.current = null;
    }
  };

  const handleStop = () => {
    abortController.current?.abort();
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-4 gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <span className="font-medium">
            Current Model: {settings.data?.selectedModel || "Not Selected"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => clearMessages.mutate()}
          disabled={!messages.data?.length}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Card className="flex-1 p-4">
        <ScrollArea ref={scrollRef} className="h-[calc(100vh-240px)]">
          <div className="space-y-4">
            {messages.data?.map((message, i) => (
              <div
                key={i}
                className={`flex gap-2 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <Bot className="h-6 w-6 text-blue-500" />
                )}
                <div
                  className={`rounded-lg px-4 py-2 max-w-[80%] ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {message.content}
                </div>
                {message.role === "user" && (
                  <User className="h-6 w-6 text-primary" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isStreaming}
        />
        {isStreaming ? (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={handleStop}
          >
            <StopCircle className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
    </div>
  );
}