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
    if (signal?.aborted) return;

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

    if (!response.body) {
      throw new Error("No response body");
    }

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        return;
      }

      try {
        const { done, value } = await reader.read();

        if (signal?.aborted) {
          await reader.cancel();
          return;
        }

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (signal?.aborted) {
            await reader.cancel();
            return;
          }

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
        if (signal?.aborted) {
          return;
        }
        throw error;
      }
    }
  } catch (error) {
    if (signal?.aborted) {
      return;
    }
    throw error;
  } finally {
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // Reader kapanırken oluşan hataları görmezden geliyoruz
      }
    }
  }
}