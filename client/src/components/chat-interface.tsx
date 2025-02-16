import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, StopCircle, Bot, User, Trash2, Link, Link2Off } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { streamChat } from "@/lib/openrouter";
import { apiRequest } from "@/lib/queryClient";
import type { Message, Settings } from "@shared/schema";
import { StopAnimation } from "./stop-animation";

export function ChatInterface() {
  const [inputs, setInputs] = useState({ model1: "", model2: "" });
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const abortController1 = useRef<AbortController>();
  const abortController2 = useRef<AbortController>();
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
    mutationFn: async (message: { role: string; content: string; id?: number; modelId?: string }) => {
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

  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<Settings>) => {
      const response = await apiRequest("POST", "/api/settings", settings);
      const data = await response.json();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
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

  const handleSubmit = async (modelNumber: 1 | 2) => {
    const input = inputs[`model${modelNumber}`];
    if (!input.trim()) return;

    setIsStopped(false);
    const modelId = modelNumber === 1 ? settings.data?.selectedModel : settings.data?.secondSelectedModel;
    if (!modelId) {
      toast({
        title: "Error",
        description: `Please select model ${modelNumber} in settings`,
        variant: "destructive",
      });
      return;
    }

    // Modele özel rol tanımı
    const modelRole = modelNumber === 1 ? "İlk model" : "İkinci model";
    const systemContext = `Sen ${modelRole} olarak görev yapıyorsun. ${
      settings.data?.modelsConnected
        ? "Diğer model ile işbirliği içinde çalışman gerekiyor. Diğer modelin yanıtlarını dikkate alarak kendi yanıtını oluştur."
        : ""
    }`;

    const userMessage = { 
      role: "user", 
      content: input,
      modelId 
    };
    await addMessage.mutateAsync(userMessage);
    setInputs(prev => ({ ...prev, [`model${modelNumber}`]: "" }));

    try {
      setIsStreaming(true);
      abortController1.current = new AbortController();
      abortController2.current = new AbortController();

      const assistantMessage = {
        role: "assistant",
        content: "",
        modelId,
      };

      const initialResponse = await addMessage.mutateAsync(assistantMessage);
      currentAssistantMessageId.current = initialResponse.id;
      const currentMessages = messages.data || [];

      let streamContent = "";
      try {
        for await (const chunk of streamChat(
          modelId,
          [
            { role: "system", content: systemContext },
            ...currentMessages,
            userMessage
          ],
          abortController1.current.signal
        )) {
          if (isStopped) {
            if (currentAssistantMessageId.current !== null) {
              await addMessage.mutateAsync({
                role: "assistant",
                content: "Mesaj gönderimi kullanıcı tarafından durduruldu.",
                id: currentAssistantMessageId.current,
                modelId,
              });
            }
            return;
          }
          streamContent += chunk;
          if (currentAssistantMessageId.current !== null) {
            await addMessage.mutateAsync({
              role: "assistant",
              content: streamContent,
              id: currentAssistantMessageId.current,
              modelId,
            });
          }
        }

        // İlk modelin yanıtını mesaj geçmişine ekleyelim
        const firstModelResponse = { role: "assistant", content: streamContent, modelId };

        if (!isStopped && settings.data?.modelsConnected) {
          const otherModelId = modelNumber === 1 ? settings.data.secondSelectedModel : settings.data.selectedModel;
          if (otherModelId) {
            const assistantMessage2 = {
              role: "assistant",
              content: "",
              modelId: otherModelId,
            };

            const initialResponse2 = await addMessage.mutateAsync(assistantMessage2);
            currentAssistantMessageId.current = initialResponse2.id;

            let streamContent2 = "";
            try {
              // İkinci model için context oluşturuyoruz
              const otherModelRole = modelNumber === 1 ? "İkinci model" : "İlk model";
              const otherModelContext = `Sen ${otherModelRole} olarak görev yapıyorsun. Diğer model şu yanıtı verdi: "${streamContent}". 
                Bu yanıtı dikkate alarak ve bağlamı koruyarak kendi yanıtını oluştur. Eğer bir sayı dizisi veya sıralı bir işlem varsa, 
                devam ettirmeye çalış. Eğer bir sohbet varsa, konuşmayı anlamlı şekilde sürdür.`;

              const messagesForSecondModel = [
                { role: "system", content: otherModelContext },
                ...currentMessages,
                userMessage,
                firstModelResponse,
              ];

              for await (const chunk of streamChat(
                otherModelId,
                messagesForSecondModel,
                abortController2.current.signal
              )) {
                if (isStopped) {
                  if (currentAssistantMessageId.current !== null) {
                    await addMessage.mutateAsync({
                      role: "assistant",
                      content: "Mesaj gönderimi kullanıcı tarafından durduruldu.",
                      id: currentAssistantMessageId.current,
                      modelId: otherModelId,
                    });
                  }
                  return;
                }
                streamContent2 += chunk;
                if (currentAssistantMessageId.current !== null) {
                  await addMessage.mutateAsync({
                    role: "assistant",
                    content: streamContent2,
                    id: currentAssistantMessageId.current,
                    modelId: otherModelId,
                  });
                }
              }
            } catch (error) {
              if (error instanceof Error && error.name !== "AbortError" && currentAssistantMessageId.current !== null) {
                await addMessage.mutateAsync({
                  role: "assistant",
                  content: "Mesaj gönderimi sırasında bir hata oluştu.",
                  id: currentAssistantMessageId.current,
                  modelId: otherModelId,
                });
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError" && currentAssistantMessageId.current !== null) {
          await addMessage.mutateAsync({
            role: "assistant",
            content: "Mesaj gönderimi sırasında bir hata oluştu.",
            id: currentAssistantMessageId.current,
            modelId,
          });
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        toast({
          title: "Error",
          description: "Failed to generate response",
          variant: "destructive",
        });
      }
    } finally {
      setIsStreaming(false);
      setIsStopped(false);
      currentAssistantMessageId.current = null;
      abortController1.current = undefined;
      abortController2.current = undefined;
    }
  };

  const handleStop = () => {
    setIsStopped(true);
    try {
      abortController1.current?.abort();
      abortController2.current?.abort();
    } catch {
      // Ignore any errors during abort
    }
  };

  const toggleModelsConnection = () => {
    if (settings.data) {
      updateSettings.mutate({
        ...settings.data,
        modelsConnected: !settings.data.modelsConnected,
      });
    }
  };

  const getModelName = (modelId?: string) => {
    if (!modelId) return "";
    return modelId.split("/").pop()?.split("-")[0] || modelId;
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-4 gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <span className="font-medium">
              Model 1: {getModelName(settings.data?.selectedModel) || "Not Selected"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <span className="font-medium">
              Model 2: {getModelName(settings.data?.secondSelectedModel) || "Not Selected"}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleModelsConnection}
            className="gap-2"
          >
            {settings.data?.modelsConnected ? (
              <>
                <Link2Off className="h-4 w-4" />
                Disconnect Models
              </>
            ) : (
              <>
                <Link className="h-4 w-4" />
                Connect Models
              </>
            )}
          </Button>
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
                className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && <Bot className="h-6 w-6 text-blue-500" />}
                <div
                  className={`rounded-lg px-4 py-2 max-w-[80%] ${
                    message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {message.role === "assistant" && message.modelId && (
                    <div className="text-xs text-muted-foreground mb-1">
                      {getModelName(message.modelId)}
                    </div>
                  )}
                  {message.content}
                </div>
                {message.role === "user" && <User className="h-6 w-6 text-primary" />}
              </div>
            ))}
            {isStopped && <StopAnimation />}
          </div>
        </ScrollArea>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(1); }} className="flex gap-2">
          <Input
            value={inputs.model1}
            onChange={(e) => setInputs(prev => ({ ...prev, model1: e.target.value }))}
            placeholder={`Message for ${getModelName(settings.data?.selectedModel)}`}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button type="button" variant="destructive" size="icon" onClick={handleStop}>
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!inputs.model1.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(2); }} className="flex gap-2">
          <Input
            value={inputs.model2}
            onChange={(e) => setInputs(prev => ({ ...prev, model2: e.target.value }))}
            placeholder={`Message for ${getModelName(settings.data?.secondSelectedModel)}`}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button type="button" variant="destructive" size="icon" onClick={handleStop}>
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!inputs.model2.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}