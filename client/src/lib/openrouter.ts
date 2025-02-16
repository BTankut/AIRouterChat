import type { OpenRouterModel } from "@shared/schema";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";

export async function fetchModels(apiKey: string): Promise<OpenRouterModel[]> {
  const response = await fetch(`${OPENROUTER_API_URL}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch models");
  }

  const data = await response.json();
  return data.data;
}

export async function* streamChat(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  signal?: AbortSignal
) {
  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": window.location.origin,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
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

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content || "";
          if (content) yield content;
        } catch (e) {
          console.error("Failed to parse chunk:", e);
        }
      }
    }
  }
}