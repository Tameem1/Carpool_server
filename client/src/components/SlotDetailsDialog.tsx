import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatGMTPlus3TimeOnly, toGMTPlus3 } from "@shared/timezone";
import { MapPin, Clock, Users, Trash2, Repeat } from "lucide-react";

export interface SlotWithMeta {
  id: number;
  seriesId: string | null;
  destination: string;
  startTime: string;
  endTime: string;
  driversNeeded: number;
  notes: string | null;
  registeredCount: number;
  isRegistered: boolean;
}

interface SlotDetailsDialogProps {
  slot: SlotWithMeta | null;
  onClose: () => void;
  isAdmin: boolean;
}

function formatDayLabel(iso: string): string {
  const g = toGMTPlus3(new Date(iso));
  const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return `${days[g.getUTCDay()]} ${g.getUTCDate()}/${g.getUTCMonth() + 1}`;
}

export function SlotDetailsDialog({ slot, onClose, isAdmin }: SlotDetailsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [alert, setAlert] = useState<"register" | "unregister" | "delete" | null>(null);

  const open = !!slot;
  const isSeries = !!slot?.seriesId;

  const { data: registrations = [] } = useQuery<any[]>({
    queryKey: ["/api/schedule/slots", slot?.id, "registrations"],
    queryFn: async () => {
      const res = await fetch(`/api/schedule/slots/${slot!.id}/registrations`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load registrations");
      return res.json();
    },
    enabled: open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/schedule/slots"] });
  };

  const registerMutation = useMutation({
    mutationFn: (repeatWeekly: boolean) =>
      apiRequest("POST", `/api/schedule/slots/${slot!.id}/register`, { repeatWeekly }),
    onSuccess: () => {
      toast({ title: "تم التسجيل" });
      invalidate();
      onClose();
    },
    onError: (e: any) =>
      toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const unregisterMutation = useMutation({
    mutationFn: (scope: "single" | "series") =>
      apiRequest("DELETE", `/api/schedule/slots/${slot!.id}/register`, { scope }),
    onSuccess: () => {
      toast({ title: "تم إلغاء التسجيل" });
      invalidate();
      onClose();
    },
    onError: (e: any) =>
      toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (scope: "single" | "series") =>
      apiRequest("DELETE", `/api/schedule/slots/${slot!.id}?scope=${scope}`),
    onSuccess: () => {
      toast({ title: "تم الحذف" });
      invalidate();
      onClose();
    },
    onError: (e: any) =>
      toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  if (!slot) return null;

  const met = slot.registeredCount >= slot.driversNeeded;

  // Register: confirm "repeat weekly?" only for recurring slots; otherwise just do it.
  const handleRegisterClick = () => {
    if (isSeries) setAlert("register");
    else registerMutation.mutate(false);
  };
  const handleUnregisterClick = () => {
    if (isSeries) setAlert("unregister");
    else unregisterMutation.mutate("single");
  };
  const handleDeleteClick = () => {
    if (isSeries) setAlert("delete");
    else deleteMutation.mutate("single");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {slot.destination}
              {isSeries && <Repeat className="h-4 w-4 text-muted-foreground" />}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              {formatDayLabel(slot.startTime)} · {formatGMTPlus3TimeOnly(new Date(slot.startTime))}
              {" - "}
              {formatGMTPlus3TimeOnly(new Date(slot.endTime))}
            </div>

            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <Badge variant={met ? "default" : "destructive"}>
                {slot.registeredCount} / {slot.driversNeeded} سائق
              </Badge>
              {!met && (
                <span className="text-muted-foreground">
                  المتبقي: {slot.driversNeeded - slot.registeredCount}
                </span>
              )}
            </div>

            {slot.notes && <p className="text-muted-foreground">{slot.notes}</p>}

            <div>
              <p className="mb-1 font-medium">السائقون المسجلون</p>
              {registrations.length === 0 ? (
                <p className="text-muted-foreground">لا يوجد سائقون بعد</p>
              ) : (
                <ul className="space-y-1">
                  {registrations.map((r) => (
                    <li key={r.id} className="flex justify-between rounded bg-muted px-2 py-1">
                      <span>{r.username}</span>
                      <span className="text-muted-foreground">{r.section}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {slot.isRegistered ? (
                <Button
                  variant="outline"
                  onClick={handleUnregisterClick}
                  disabled={unregisterMutation.isPending}
                >
                  إلغاء تسجيلي
                </Button>
              ) : (
                <Button onClick={handleRegisterClick} disabled={registerMutation.isPending}>
                  سجّلني كسائق
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="destructive"
                  onClick={handleDeleteClick}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="ml-1 h-4 w-4" />
                  حذف
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Register: repeat weekly? */}
      <AlertDialog open={alert === "register"} onOpenChange={(o) => !o && setAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تسجيل متكرر</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد تسجيل نفسك في هذا الموعد كل أسبوع حتى نهاية التكرار؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => registerMutation.mutate(false)}>
              هذا الموعد فقط
            </AlertDialogAction>
            <AlertDialogAction onClick={() => registerMutation.mutate(true)}>
              نعم، كرر أسبوعياً
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unregister: single or whole series */}
      <AlertDialog open={alert === "unregister"} onOpenChange={(o) => !o && setAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>إلغاء التسجيل</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد إلغاء تسجيلك من هذا الموعد فقط أم من جميع المواعيد القادمة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={() => unregisterMutation.mutate("single")}>
              هذا الموعد فقط
            </AlertDialogAction>
            <AlertDialogAction onClick={() => unregisterMutation.mutate("series")}>
              كل المواعيد القادمة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete (admin): single or whole series */}
      <AlertDialog open={alert === "delete"} onOpenChange={(o) => !o && setAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الموعد</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف هذا الموعد فقط أم هذا الموعد وجميع المواعيد القادمة في السلسلة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate("single")}>
              هذا الموعد فقط
            </AlertDialogAction>
            <AlertDialogAction onClick={() => deleteMutation.mutate("series")}>
              هذا وكل القادم
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
