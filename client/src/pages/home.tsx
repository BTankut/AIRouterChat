import { SettingsDialog } from "@/components/settings-dialog";
import { ChatInterface } from "@/components/chat-interface";

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="max-w-4xl mx-auto p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">AI Chat</h1>
          <SettingsDialog />
        </div>
      </header>
      <main className="h-[calc(100vh-73px)]">
        <ChatInterface />
      </main>
    </div>
  );
}
