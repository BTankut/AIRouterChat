import type { OpenRouterModel } from "@shared/schema";

export async function fetchModels(): Promise<OpenRouterModel[]> {
  const response = await fetch("/api/models");

  if (!response.ok) {
    throw new Error("Failed to fetch models");
  }

  return await response.json();
}

export async function* streamChat(
  model: string,
  messages: { role: string; content: string }[],
  signal?: AbortSignal
) {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error("Failed to generate response");
    }

    reader = response.body?.getReader();
    if (!reader) throw new Error("No reader available");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      try {
        const { done, value } = await reader.read();
        if (done) break;

        // Signal kontrolü
        if (signal?.aborted) {
          reader.cancel(); // Reader'ı temiz bir şekilde kapatıyoruz
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") return;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) yield parsed.content;
            } catch {
              continue;
            }
          }
        }
      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
          // Abort edildiğinde sessizce çıkıyoruz
          return;
        }
        throw error; // Diğer hataları yeniden fırlatıyoruz
      }
    }
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      // Abort edildiğinde sessizce çıkıyoruz
      return;
    }
    throw error; // Diğer hataları yeniden fırlatıyoruz
  } finally {
    // Her zaman reader'ı temizliyoruz
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // Reader kapanırken oluşan hataları görmezden geliyoruz
      }
    }
  }
}