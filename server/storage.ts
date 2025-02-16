import { settings, messages, type Settings, type InsertSettings, type Message, type InsertMessage } from "@shared/schema";

export interface IStorage {
  getSettings(): Promise<Settings | undefined>;
  updateSettings(settings: InsertSettings): Promise<Settings>;
  getMessages(): Promise<Message[]>;
  addMessage(message: InsertMessage & { id?: number }): Promise<Message>;
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

  async addMessage(message: InsertMessage & { id?: number }): Promise<Message> {
    if (message.id !== undefined) {
      // Eğer id verilmişse, mevcut mesajı güncelle
      const index = this.messages.findIndex((m) => m.id === message.id);
      if (index !== -1) {
        const updatedMessage = { ...this.messages[index], ...message };
        this.messages[index] = updatedMessage;
        return updatedMessage;
      }
    }

    // Yeni mesaj ekle
    const newMessage = { ...message, id: this.currentId++ };
    this.messages.push(newMessage);
    return newMessage;
  }

  async clearMessages(): Promise<void> {
    this.messages = [];
  }
}

export const storage = new MemStorage();