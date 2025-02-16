import { settings, messages, type Settings, type InsertSettings, type Message, type InsertMessage } from "@shared/schema";

export interface IStorage {
  getSettings(): Promise<Settings | undefined>;
  updateSettings(settings: InsertSettings): Promise<Settings>;
  getMessages(): Promise<Message[]>;
  addMessage(message: InsertMessage): Promise<Message>;
  clearMessages(): Promise<void>;
}

export class MemStorage implements IStorage {
  private settings?: Settings;
  private messages: Message[] = [];
  private currentId = 1;

  async getSettings(): Promise<Settings | undefined> {
    return this.settings;
  }

  async updateSettings(newSettings: InsertSettings): Promise<Settings> {
    this.settings = { id: 1, ...newSettings };
    return this.settings;
  }

  async getMessages(): Promise<Message[]> {
    return this.messages;
  }

  async addMessage(message: InsertMessage): Promise<Message> {
    const newMessage = { ...message, id: this.currentId++ };
    this.messages.push(newMessage);
    return newMessage;
  }

  async clearMessages(): Promise<void> {
    this.messages = [];
  }
}

export const storage = new MemStorage();
