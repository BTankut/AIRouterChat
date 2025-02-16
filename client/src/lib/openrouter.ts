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
  const controller = new AbortController();

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

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader available");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Handle AbortError during reading
        if (signal?.aborted) {
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
            } catch (e) {
              // Silently ignore parse errors
              continue;
            }
          }
        }
      }
    } catch (error) {
      // If it's an AbortError, just return silently
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      throw error;
    } finally {
      reader.cancel();
    }
  } catch (error) {
    // If it's an AbortError, just return silently
    if (error instanceof Error && error.name === "AbortError") {
      return;
    }
    throw error;
  }
}