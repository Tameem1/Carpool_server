import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

const joinRequestSchema = z.object({
  seatsRequested: z.number().min(1, "يجب طلب مقعد واحد على الأقل"),
  message: z.string().optional(),
});

type JoinRequestFormData = z.infer<typeof joinRequestSchema>;

interface TripJoinRequestFormProps {
  open: boolean;
  onClose: () => void;
  tripId: number;
  trip: {
    fromLocation: string;
    toLocation: string;
    departureTime: string;
    availableSeats: number;
    driver?: {
      firstName: string;
      lastName: string;
    };
  };
}

export function TripJoinRequestForm({ open, onClose, tripId, trip }: TripJoinRequestFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<JoinRequestFormData>({
    resolver: zodResolver(joinRequestSchema),
    defaultValues: {
      seatsRequested: 1,
      message: "",
    },
  });

  const joinRequestMutation = useMutation({
    mutationFn: async (data: JoinRequestFormData) => {
      const response = await fetch(`/api/trips/${tripId}/join-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send join request");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips/my"] });
      toast({
        title: "تم الانضمام بنجاح",
        description: "لقد انضممت إلى الرحلة بنجاح. تم إشعار السائق.",
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إرسال طلب الانضمام",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: JoinRequestFormData) => {
    setIsSubmitting(true);
    joinRequestMutation.mutate(data);
    setIsSubmitting(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">الانضمام للرحلة</DialogTitle>
          <DialogDescription className="text-right">
            انضم إلى هذه الرحلة فوراً
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Trip Details */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h4 className="font-medium text-sm mb-2">تفاصيل الرحلة:</h4>
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
              <p><span className="font-medium">من:</span> {trip.fromLocation}</p>
              <p><span className="font-medium">إلى:</span> {trip.toLocation}</p>
              <p><span className="font-medium">التوقيت:</span> {formatDate(trip.departureTime)}</p>
              <p><span className="font-medium">المقاعد المتاحة:</span> {trip.availableSeats}</p>
              {trip.driver && (
                <p><span className="font-medium">السائق:</span> {trip.driver.firstName} {trip.driver.lastName}</p>
              )}
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-right block">رسالة إضافية (اختيارية)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="أضف أي ملاحظات أو تفاصيل إضافية..."
                        {...field}
                        className="text-right"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting || joinRequestMutation.isPending}
                  className="flex-1"
                >
                  {isSubmitting || joinRequestMutation.isPending ? "جاري الانضمام..." : "انضم الآن"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}