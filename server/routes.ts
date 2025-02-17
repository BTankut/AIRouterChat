import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertSettingsSchema, insertMessageSchema } from "@shared/schema";

async function fetchModels() {
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch models");
  }

  const data = await response.json();
  return data.data;
}

async function* streamChat(
  model: string,
  messages: { role: string; content: string }[],
) {
  console.log("Streaming chat with model:", model);
  console.log("Messages:", messages);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "http://localhost:5000",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.7, // Yaratıcılığı artırmak için
      max_tokens: 1000, // Daha uzun yanıtlar için
    }),
  });

  console.log("OpenRouter API Response Status:", response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenRouter API Error:", errorText);
    throw new Error(`Failed to generate response: ${errorText}`);
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
          // Güvenli bir şekilde content'i alıyoruz
          const content = parsed.choices?.[0]?.delta?.content;
          // Sadece içerik varsa yield ediyoruz
          if (content) yield content;
        } catch (e) {
          console.error("Failed to parse chunk:", e, "Raw data:", data);
          continue;
        }
      }
    }
  }
}

export async function registerRoutes(app: Express) {
  app.get("/api/settings", async (req, res) => {
    const settings = await storage.getSettings();
    res.json(settings);
  });

  app.post("/api/settings", async (req, res) => {
    const parsed = insertSettingsSchema.parse(req.body);
    const settings = await storage.updateSettings(parsed);
    res.json(settings);
  });

  app.get("/api/messages", async (req, res) => {
    const messages = await storage.getMessages();
    res.json(messages);
  });

  app.post("/api/messages", async (req, res) => {
    const parsed = insertMessageSchema.parse(req.body);
    const message = await storage.addMessage(parsed);
    res.json(message);
  });

  app.post("/api/messages/clear", async (req, res) => {
    await storage.clearMessages();
    res.json({ success: true });
  });

  app.get("/api/models", async (req, res) => {
    try {
      const models = await fetchModels();
      res.json(models);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/test-openrouter", async (req, res) => {
    try {
      console.log("Testing OpenRouter API connection...");
      console.log("API Key:", process.env.OPENROUTER_API_KEY);
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:5000",
        },
        body: JSON.stringify({
          model: "google/gemini-pro",
          messages: [{ role: "user", content: "Merhaba" }],
          stream: false
        }),
      });

      console.log("Response status:", response.status);
      const data = await response.text();
      console.log("Response data:", data);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} - ${data}`);
      }

      res.json({ status: "success", data });
    } catch (error) {
      console.error("Test failed:", error);
      res.status(500).json({ status: "error", error: error.message });
    }
  });

  app.post("/api/chat/stream", async (req, res) => {
    try {
      const { model, messages } = req.body;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of streamChat(model, messages)) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("Stream error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}