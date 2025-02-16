import { pgTable, text, serial, json, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  selectedModel: text("selected_model").notNull(),
  secondSelectedModel: text("second_selected_model").notNull().default(''), // Add default empty string
  modelsConnected: boolean("models_connected").notNull().default(false),
});

export const insertSettingsSchema = createInsertSchema(settings);
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  timestamp: text("timestamp").notNull(),
  modelId: text("model_id"), // Which model sent this message (null for user messages)
});

export const insertMessageSchema = createInsertSchema(messages);
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type OpenRouterModel = {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
};