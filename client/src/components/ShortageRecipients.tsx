import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bell, Send } from "lucide-react";

interface AppUser {
  id: string;
  username: string;
  section: string;
  telegramUsername?: string | null;
}

// Admin panel: choose which users receive the daily driver-shortage Telegram
// digest (sent automatically at 9 AM and 12 PM GMT+3), and trigger an on-demand run.
export function ShortageRecipients() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: recipientData } = useQuery<{ recipientIds: string[] }>({
    queryKey: ["/api/admin/shortage-recipients"],
  });

  // Seed the local selection from the server whenever it (re)loads.
  useEffect(() => {
    if (recipientData?.recipientIds) {
      setSelected(new Set(recipientData.recipientIds));
    }
  }, [recipientData]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/admin/shortage-recipients", {
        userIds: Array.from(selected),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم الحفظ", description: "تم تحديث قائمة المستلمين بنجاح." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shortage-recipients"] });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في حفظ قائمة المستلمين",
        variant: "destructive",
      });
    },
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/shortage-check/run");
      return res.json() as Promise<{ understaffed: number; recipientsNotified: number }>;
    },
    onSuccess: (data) => {
      toast({
        title: "تم تشغيل الفحص",
        description: `رحلات ناقصة: ${data.understaffed} — تم إشعار ${data.recipientsNotified} مستلم.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في تشغيل الفحص",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          تنبيهات نقص السائقين
        </CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          يتم فحص جدول اليوم تلقائياً الساعة 9 صباحاً و12 ظهراً (بتوقيت GMT+3). اختر المستخدمين الذين
          سيستلمون رسالة تيليجرام عند نقص عدد السائقين.
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 rounded-md border p-2">
          {users.length === 0 ? (
            <p className="text-sm text-gray-500 p-2">لا يوجد مستخدمون.</p>
          ) : (
            <div className="space-y-1">
              {users.map((u) => {
                const noTelegram = !u.telegramUsername;
                return (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.has(u.id)}
                      onCheckedChange={() => toggle(u.id)}
                    />
                    <span className="flex-1 text-sm">
                      {u.username}
                      <span className="text-gray-400"> · {u.section}</span>
                    </span>
                    {noTelegram && (
                      <span className="text-xs text-amber-600">لا يوجد تيليجرام</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between gap-2 mt-4">
          <span className="text-sm text-gray-500">{selected.size} محدد</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              تشغيل الفحص الآن
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              حفظ المستلمين
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
