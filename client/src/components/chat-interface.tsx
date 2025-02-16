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
    setIsStreaming(true);

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
    const systemContext = `Sen ${modelRole} olarak görev yapıyorsun. 
    Görevin:
    1. Diğer model ile sürekli iletişim halinde olmak
    2. Diğer modelin yanıtlarını dikkate alarak kendi yanıtını oluşturmak
    3. Konuşmayı sürdürmek ve geliştirmek
    4. Her yanıtında mutlaka bir soru sormak veya yorum yapmak
    5. Konuşmanın doğal akışını korumak
    6. Asla konuşmayı sonlandırmamak
    
    ${settings.data?.modelsConnected
        ? `Önemli: Bu bir sürekli diyalog. 
           1. Her yanıtında karşı tarafa soru sor veya yorum yap
           2. Konuşmayı asla sonlandırma
           3. Diğer modelin sorusunu mutlaka yanıtla
           4. Eğer bir sayı dizisi veya sıralı işlem varsa, devam ettir
           5. Eğer bir konu tartışılıyorsa, fikrini belirt ve tartışmayı sürdür
           6. Her yanıt bir sonraki yanıt için zemin hazırlamalı`
        : ""}`;

    const userMessage = {
      role: "user",
      content: input,
      modelId
    };

    try {
      await addMessage.mutateAsync(userMessage);
      setInputs(prev => ({ ...prev, [`model${modelNumber}`]: "" }));

      // Her model için yeni bir abort controller oluştur
      abortController1.current = new AbortController();
      abortController2.current = new AbortController();

      while (!isStopped && settings.data?.modelsConnected) {
        // isStopped kontrolü eklendi
        if (isStopped) {
          return;
        }

        // İlk model yanıtı
        const assistantMessage1 = {
          role: "assistant",
          content: "",
          modelId,
        };

        const initialResponse1 = await addMessage.mutateAsync(assistantMessage1);
        currentAssistantMessageId.current = initialResponse1.id;
        const currentMessages = messages.data || [];

        let streamContent1 = "";
        try {
          for await (const chunk of streamChat(
            modelId,
            [
              { role: "system", content: systemContext },
              ...currentMessages.slice(-10),
              userMessage
            ],
            abortController1.current?.signal
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

            streamContent1 += chunk;
            if (currentAssistantMessageId.current !== null) {
              await addMessage.mutateAsync({
                role: "assistant",
                content: streamContent1,
                id: currentAssistantMessageId.current,
                modelId,
              });
            }
          }

          // İkinci model için hazırlık
          const otherModelId = modelNumber === 1 ? settings.data.secondSelectedModel : settings.data.selectedModel;
          if (!otherModelId) continue;

          const assistantMessage2 = {
            role: "assistant",
            content: "",
            modelId: otherModelId,
          };

          const initialResponse2 = await addMessage.mutateAsync(assistantMessage2);
          currentAssistantMessageId.current = initialResponse2.id;

          let streamContent2 = "";
          let retryCount = 0;
          const maxRetries = 3;

          while (retryCount < maxRetries && !isStopped) {
            try {
              const otherModelRole = modelNumber === 1 ? "İkinci model" : "İlk model";
              const otherModelContext = `Sen ${otherModelRole} olarak görev yapıyorsun. 

Önceki yanıt: "${streamContent1}"

Görevlerin:
1. Yukarıdaki yanıtı dikkatlice analiz et
2. Bağlamı koruyarak kendi yanıtını oluştur
3. Her yanıtında mutlaka bir soru sor veya yorum yap
4. Konuşmayı asla sonlandırma
5. Diğer modelin sorusunu mutlaka yanıtla
6. Konuşmanın doğal akışını koru
7. Her yanıt bir sonraki yanıt için zemin hazırlamalı

ÖNEMLİ: Yanıtın boş olamaz ve en az bir cümle içermelidir.`;

              const messagesForSecondModel = [
                { role: "system", content: otherModelContext },
                ...currentMessages.slice(-10),
                { role: "assistant", content: streamContent1, modelId },
                { role: "user", content: streamContent1 }
              ];

              let hasResponse = false;
              let isValidResponse = false;

              for await (const chunk of streamChat(
                otherModelId,
                messagesForSecondModel,
                abortController2.current?.signal
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

                // Boş chunk kontrolü
                if (!chunk || chunk.trim() === "") continue;

                streamContent2 += chunk;
                hasResponse = true;

                // Yanıt uzunluğu kontrolü
                if (streamContent2.trim().length > 0) {
                  isValidResponse = true;
                }

                if (currentAssistantMessageId.current !== null) {
                  await addMessage.mutateAsync({
                    role: "assistant",
                    content: streamContent2,
                    id: currentAssistantMessageId.current,
                    modelId: otherModelId,
                  });
                }
              }

              // Geçerli yanıt kontrolü
              if (!isValidResponse) {
                retryCount++;
                if (retryCount < maxRetries) {
                  await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                  streamContent2 = "";
                  continue;
                } else {
                  if (currentAssistantMessageId.current !== null) {
                    await addMessage.mutateAsync({
                      role: "assistant",
                      content: "Üzgünüm, geçerli bir yanıt oluşturulamadı. Lütfen tekrar deneyin.",
                      id: currentAssistantMessageId.current,
                      modelId: otherModelId,
                    });
                  }
                  break;
                }
              }

              // Yeni bir tur başlatmak için kullanıcı mesajını güncelle
              if (isValidResponse) {
                userMessage.content = streamContent2;
                break;
              }

            } catch (error) {
              if (error instanceof Error && error.name === "AbortError") {
                // Abort edildiğinde sessizce çık
                return;
              }

              retryCount++;
              if (retryCount === maxRetries && currentAssistantMessageId.current !== null) {
                await addMessage.mutateAsync({
                  role: "assistant",
                  content: "Üzgünüm, yanıt oluşturulamadı. Lütfen tekrar deneyin.",
                  id: currentAssistantMessageId.current,
                  modelId: otherModelId,
                });
                return;
              }
              if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              }
            }
          }

          // Kısa bir bekleme süresi ekleyelim
          if (!isStopped) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            // Abort edildiğinde sessizce çık
            return;
          }

          if (currentAssistantMessageId.current !== null) {
            await addMessage.mutateAsync({
              role: "assistant",
              content: "Mesaj gönderimi sırasında bir hata oluştu.",
              id: currentAssistantMessageId.current,
              modelId,
            });
          }
          break;
        }
      }
    } catch (error) {
      // AbortError'ları sessizce yönet
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      // Diğer hataları toast ile göster
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
    setIsStreaming(false);

    try {
      // Her iki modelin abort controller'ını hemen sonlandır
      if (abortController1.current) {
        abortController1.current.abort();
        abortController1.current = undefined;
      }
      if (abortController2.current) {
        abortController2.current.abort();
        abortController2.current = undefined;
      }

      // Mevcut mesajı sonlandır
      if (currentAssistantMessageId.current !== null) {
        addMessage.mutate({
          role: "assistant",
          content: "Mesaj gönderimi durduruldu.",
          id: currentAssistantMessageId.current,
          modelId: settings.data?.selectedModel, //Using selectedModel as a fallback.  Could be improved.
        });
      }
      currentAssistantMessageId.current = null;
    } catch (error) {
      // Abort sırasındaki hataları sessizce yönet
      console.debug("Error during abort:", error);
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