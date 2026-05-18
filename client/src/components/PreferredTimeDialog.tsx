import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Save, Clock } from "lucide-react";

interface PreferredTimeDialogProps {
  open: boolean;
  onClose: () => void;
}

export function PreferredTimeDialog({ open, onClose }: PreferredTimeDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  useEffect(() => {
    if (open && user) {
      setStart(user.preferredDepartureStart || "");
      setEnd(user.preferredDepartureEnd || "");
    }
  }, [open, user]);

  const mutation = useMutation({
    mutationFn: async () =>
      apiRequest("PATCH", "/api/users/profile", {
        preferredDepartureStart: start,
        preferredDepartureEnd: end,
      }),
    onSuccess: () => {
      toast({
        title: "تم الحفظ",
        description: "تم تحديث وقت المغادرة المفضل.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في حفظ التفضيل",
        variant: "destructive",
      });
    },
  });

  const handleClear = () => {
    setStart("");
    setEnd("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            وقت المغادرة المفضل
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            سنرسل لك إشعاراً على تيليجرام عند إنشاء رحلة جديدة تنطلق ضمن هذا النطاق (بتوقيت GMT+3). اترك أحد الحقلين فارغاً لتعطيل الإشعارات.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pref-start" className="text-xs">من</Label>
              <Input
                id="pref-start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pref-end" className="text-xs">إلى</Label>
              <Input
                id="pref-end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={mutation.isPending}
              className="flex-1"
            >
              مسح
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              {mutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
