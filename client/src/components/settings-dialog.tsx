import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { fetchModels } from "@/lib/openrouter";
import type { OpenRouterModel, Settings } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [secondSelectedModel, setSecondSelectedModel] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const settings = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const models = useQuery<OpenRouterModel[]>({
    queryKey: ["models"],
    queryFn: fetchModels,
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: { selectedModel: string, secondSelectedModel: string }) => {
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

  useEffect(() => {
    if (settings.data) {
      setSelectedModel(settings.data.selectedModel);
      setSecondSelectedModel(settings.data.secondSelectedModel);
    }
  }, [settings.data]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings.mutate({ selectedModel, secondSelectedModel });
  };

  // Format price to show cost per 1M tokens
  const formatPrice = (price: string) => {
    const pricePerMillion = parseFloat(price) * 1000000;
    return pricePerMillion.toFixed(2);
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
            <label className="text-sm font-medium">Model 1</label>
            <Select
              value={selectedModel}
              onValueChange={setSelectedModel}
              disabled={!models.data?.length}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select first model" />
              </SelectTrigger>
              <SelectContent>
                {models.data?.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col">
                      <span>{model.name}</span>
                      <span className="text-xs text-gray-500">
                        {model.context_length} tokens | ${formatPrice(model.pricing.prompt)}/1M prompt, ${formatPrice(model.pricing.completion)}/1M completion
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Model 2</label>
            <Select
              value={secondSelectedModel}
              onValueChange={setSecondSelectedModel}
              disabled={!models.data?.length}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select second model" />
              </SelectTrigger>
              <SelectContent>
                {models.data?.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col">
                      <span>{model.name}</span>
                      <span className="text-xs text-gray-500">
                        {model.context_length} tokens | ${formatPrice(model.pricing.prompt)}/1M prompt, ${formatPrice(model.pricing.completion)}/1M completion
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {models.isLoading && <p className="text-sm text-gray-500">Loading models...</p>}
            {models.isError && <p className="text-sm text-red-500">Failed to load models.</p>}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={updateSettings.isPending || (!selectedModel && !secondSelectedModel && models.data && models.data.length > 0)}
          >
            {updateSettings.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}