import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Key } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { fetchModels } from "@/lib/openrouter";
import type { OpenRouterModel } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  const settings = useQuery({
    queryKey: ["/api/settings"],
  });

  const models = useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      if (!settings.data?.apiKey) return [];
      return await fetchModels(settings.data.apiKey);
    },
    enabled: !!settings.data?.apiKey,
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: { apiKey: string; selectedModel: string }) => {
      await apiRequest("POST", "/api/settings", newSettings);
    },
    onSuccess: () => {
      toast({
        title: "Settings updated",
        description: "Your changes have been saved successfully.",
      });
      setOpen(false);
    },
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const apiKey = form.apiKey.value;
    const selectedModel = form.selectedModel.value;
    
    if (!apiKey || !selectedModel) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    updateSettings.mutate({ apiKey, selectedModel });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">OpenRouter API Key</label>
            <div className="relative">
              <Input
                name="apiKey"
                type="password"
                defaultValue={settings.data?.apiKey}
                placeholder="Enter your API key"
              />
              <Key className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <Select name="selectedModel" defaultValue={settings.data?.selectedModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {models.data?.map((model: OpenRouterModel) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col">
                      <span>{model.name}</span>
                      <span className="text-xs text-gray-500">
                        {model.context_length} tokens | ${model.pricing.prompt}/1k prompt, ${model.pricing.completion}/1k completion
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={updateSettings.isPending}>
            Save Changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
