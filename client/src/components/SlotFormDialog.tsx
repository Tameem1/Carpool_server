import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// 0 = Sunday .. 6 = Saturday (matches the server's daysOfWeek convention).
const WEEKDAYS = [
  { value: 0, label: "الأحد" },
  { value: 1, label: "الإثنين" },
  { value: 2, label: "الثلاثاء" },
  { value: 3, label: "الأربعاء" },
  { value: 4, label: "الخميس" },
  { value: 5, label: "الجمعة" },
  { value: 6, label: "السبت" },
];

const DURATIONS = [
  { value: 30, label: "30 دقيقة" },
  { value: 60, label: "ساعة" },
  { value: 90, label: "ساعة ونصف" },
  { value: 120, label: "ساعتان" },
  { value: 180, label: "3 ساعات" },
  { value: 240, label: "4 ساعات" },
];

const formSchema = z
  .object({
    destination: z.string().min(1, "الوجهة مطلوبة"),
    startTime: z.string().min(1, "الوقت مطلوب"),
    durationMinutes: z.number().min(15),
    driversNeeded: z.number().min(1, "سائق واحد على الأقل"),
    notes: z.string().optional(),
    isRecurring: z.boolean().default(false),
    daysOfWeek: z.array(z.number()).default([]),
    endDate: z.string().optional(),
  })
  .refine((d) => !d.isRecurring || d.daysOfWeek.length > 0, {
    message: "اختر يوماً واحداً على الأقل",
    path: ["daysOfWeek"],
  })
  .refine((d) => !d.isRecurring || !!d.endDate, {
    message: "تاريخ الانتهاء مطلوب",
    path: ["endDate"],
  });

type FormData = z.infer<typeof formSchema>;

interface SlotFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Prefilled GMT+3 wall-clock start time, e.g. "2026-06-10T13:00". */
  defaultStart?: string;
}

export function SlotFormDialog({ open, onClose, defaultStart }: SlotFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      destination: "",
      startTime: defaultStart || "",
      durationMinutes: 60,
      driversNeeded: 1,
      notes: "",
      isRecurring: false,
      daysOfWeek: defaultStart ? [new Date(defaultStart).getDay()] : [],
      endDate: "",
    },
  });

  // Re-seed the form whenever the dialog opens from a fresh calendar click.
  useEffect(() => {
    if (open) {
      form.reset({
        destination: "",
        startTime: defaultStart || "",
        durationMinutes: 60,
        driversNeeded: 1,
        notes: "",
        isRecurring: false,
        daysOfWeek: defaultStart ? [new Date(defaultStart).getDay()] : [],
        endDate: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultStart]);

  const isRecurring = form.watch("isRecurring");

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload: any = {
        destination: data.destination,
        startTime: data.startTime,
        durationMinutes: data.durationMinutes,
        driversNeeded: data.driversNeeded,
        notes: data.notes || undefined,
      };
      if (data.isRecurring && data.endDate) {
        payload.recurrence = {
          daysOfWeek: data.daysOfWeek,
          endDate: data.endDate,
        };
      }
      return apiRequest("POST", "/api/schedule/slots", payload);
    },
    onSuccess: async (res) => {
      const result = await res.json();
      toast({
        title: "تم إنشاء الموعد",
        description: `تم إنشاء ${result.created} موعد`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/slots"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل إنشاء الموعد",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إضافة موعد جديد</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => createMutation.mutate(d))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="destination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الوجهة</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: النادي" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>وقت البداية</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="durationMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>المدة</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DURATIONS.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="driversNeeded"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>عدد السائقين المطلوبين</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isRecurring"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">تكرار أسبوعي</FormLabel>
                </FormItem>
              )}
            />

            {isRecurring && (
              <div className="space-y-3 rounded-md border p-3">
                <FormField
                  control={form.control}
                  name="daysOfWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>أيام التكرار</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAYS.map((day) => {
                          const checked = field.value?.includes(day.value);
                          return (
                            <Label
                              key={day.value}
                              className={`flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-sm ${
                                checked ? "bg-primary text-primary-foreground" : ""
                              }`}
                            >
                              <Checkbox
                                className="hidden"
                                checked={checked}
                                onCheckedChange={(c) => {
                                  const set = new Set(field.value || []);
                                  if (c) set.add(day.value);
                                  else set.delete(day.value);
                                  field.onChange(Array.from(set).sort());
                                }}
                              />
                              {day.label}
                            </Label>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>يتكرر حتى</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ملاحظات (اختياري)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                إلغاء
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "جاري الحفظ..." : "حفظ"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
