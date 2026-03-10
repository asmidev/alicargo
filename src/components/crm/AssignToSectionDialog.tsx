import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle, Package, MapPin } from "lucide-react";
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { Progress } from "@/components/ui/progress";

interface AssignToSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: string[];
  warehouseId: string;
  onSuccess?: () => void;
}

interface Section {
  id: string;
  zone: string;
  shelf: string;
  capacity: number;
  current_count: number;
}

export function AssignToSectionDialog({
  open,
  onOpenChange,
  selectedItems,
  warehouseId,
  onSuccess,
}: AssignToSectionDialogProps) {
  const [selectedSection, setSelectedSection] = useState<string>("");
  const queryClient = useQueryClient();

  // Fetch sections for this warehouse
  const { data: sections = [], isLoading } = useQuery({
    queryKey: ["warehouse-sections", warehouseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_locations")
        .select("id, zone, shelf, capacity, current_count")
        .eq("warehouse_id", warehouseId)
        .order("zone")
        .order("shelf");

      if (error) throw error;
      return data as Section[];
    },
    enabled: open && !!warehouseId,
  });

  const assignMutation = useMutation({
    mutationFn: async ({
      itemIds,
      sectionId,
    }: {
      itemIds: string[];
      sectionId: string;
    }) => {
      const { error } = await supabase
        .from("product_items")
        .update({ warehouse_location_id: sectionId })
        .in("id", itemIds);

      if (error) throw error;
    },
    onSuccess: () => {
      const section = sections.find((s) => s.id === selectedSection);
      toast.success(
        `${selectedItems.length} ta mahsulot "${section?.zone} / ${section?.shelf}" bo'limiga joylashtirildi`
      );
      queryClient.invalidateQueries({ queryKey: ["tashkent-products"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-sections"] });
      queryClient.invalidateQueries({ queryKey: ["tashkent-sections"] });
      setSelectedSection("");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Assignment error:", error);
      toast.error("Xatolik: Mahsulotlarni joylashtirish amalga oshmadi");
    },
  });

  const handleAssign = () => {
    if (!selectedSection) {
      toast.error("Bo'limni tanlang");
      return;
    }

    const section = sections.find((s) => s.id === selectedSection);
    if (section) {
      const availableSpace = section.capacity - section.current_count;
      if (selectedItems.length > availableSpace) {
        toast.error(
          `Bo'limda joy yetarli emas. Bo'sh joy: ${availableSpace}, tanlangan: ${selectedItems.length}`
        );
        return;
      }
    }

    assignMutation.mutate({
      itemIds: selectedItems,
      sectionId: selectedSection,
    });
  };

  const getCapacityColor = (current: number, capacity: number) => {
    const percentage = (current / capacity) * 100;
    if (percentage >= 90) return "bg-destructive";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-primary";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Mahsulotlarni bo'limga joylashtirish
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>Tanlangan: {selectedItems.length} ta mahsulot</span>
          </div>

          {isLoading ? (
            <LoadingSkeleton count={3} compact />
          ) : sections.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <p>Bo'limlar topilmadi. Avval bo'lim yarating.</p>
            </div>
          ) : (
            <RadioGroup
              value={selectedSection}
              onValueChange={setSelectedSection}
              className="space-y-2"
            >
              {sections.map((section) => {
                const percentage = Math.round(
                  (section.current_count / section.capacity) * 100
                );
                const availableSpace = section.capacity - section.current_count;
                const hasEnoughSpace = availableSpace >= selectedItems.length;

                return (
                  <div
                    key={section.id}
                    className={`flex items-center space-x-3 border rounded-lg p-3 transition-colors ${
                      selectedSection === section.id
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    } ${!hasEnoughSpace ? "opacity-50" : "cursor-pointer"}`}
                  >
                    <RadioGroupItem
                      value={section.id}
                      id={section.id}
                      disabled={!hasEnoughSpace}
                    />
                    <Label
                      htmlFor={section.id}
                      className={`flex-1 ${hasEnoughSpace ? "cursor-pointer" : ""}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">
                          {section.zone} / {section.shelf}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {section.current_count}/{section.capacity}
                          {!hasEnoughSpace && (
                            <span className="ml-2 text-destructive">
                              (joy yetarli emas)
                            </span>
                          )}
                        </span>
                      </div>
                      <Progress
                        value={percentage}
                        className={`h-2 ${getCapacityColor(section.current_count, section.capacity)}`}
                      />
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button
            onClick={handleAssign}
            disabled={
              !selectedSection ||
              assignMutation.isPending ||
              sections.length === 0
            }
          >
            {assignMutation.isPending ? "Joylashtirilmoqda..." : "Joylashtirish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
