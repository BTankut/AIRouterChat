import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertSettingsSchema, insertMessageSchema } from "@shared/schema";

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

  const httpServer = createServer(app);
  return httpServer;
}
