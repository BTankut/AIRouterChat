import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Key } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { fetchModels } from "@/lib/openrouter";
import type { OpenRouterModel, Settings } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const settings = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const models = useQuery<OpenRouterModel[]>({
    queryKey: ["models", apiKey],
    queryFn: async () => {
      if (!apiKey) return [];
      return await fetchModels(apiKey);
    },
    enabled: !!apiKey,
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: { apiKey: string; selectedModel: string }) => {
      await apiRequest("POST", "/api/settings", newSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings updated",
        description: "Your changes have been saved successfully.",
      });
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Form verilerini mevcut ayarlarla doldur
  useEffect(() => {
    if (settings.data) {
      setApiKey(settings.data.apiKey);
      setSelectedModel(settings.data.selectedModel);
    }
  }, [settings.data]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey) {
      toast({
        title: "Error",
        description: "Please enter your OpenRouter API key",
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
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setSelectedModel(""); // API anahtarı değiştiğinde model seçimini sıfırla
                }}
                type="password"
                placeholder="Enter your API key"
              />
              <Key className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <Select
              value={selectedModel}
              onValueChange={setSelectedModel}
              disabled={!models.data?.length}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {models.data?.map((model) => (
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
            {models.isLoading && <p className="text-sm text-gray-500">Loading models...</p>}
            {models.isError && <p className="text-sm text-red-500">Failed to load models. Please check your API key.</p>}
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={updateSettings.isPending || !apiKey || (!selectedModel && models.data && models.data.length > 0)}
          >
            {updateSettings.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}