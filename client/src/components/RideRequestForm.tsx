import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableUserSelect } from "@/components/ui/searchable-user-select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatDateForInput, parseDateTimeLocalToUTC } from "@shared/timezone";

// Helper function to convert time to today's date with that time
function timeToTodayTimestamp(timeString: string): string {
  if (!timeString) return "";
  const today = new Date();
  const [hours, minutes] = timeString.split(':');
  today.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  return today.toISOString();
}

const rideRequestFormSchema = z.object({
  fromLocation: z.string().min(1, "موقع الانطلاق مطلوب"),
  toLocation: z.string().min(1, "الوجهة مطلوبة"),
  preferredTime: z.string().min(1, "الوقت المفضل مطلوب"),
  riderId: z.string().optional(), // For admin to select rider
});

type RideRequestFormData = z.infer<typeof rideRequestFormSchema>;

interface RideRequestFormProps {
  open: boolean;
  onClose: () => void;
}

export function RideRequestForm({ open, onClose }: RideRequestFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch users list for admin
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    enabled: !!user && user.role === 'admin',
  });

  const form = useForm<RideRequestFormData>({
    resolver: zodResolver(rideRequestFormSchema),
    defaultValues: {
      fromLocation: "",
      toLocation: "",
      preferredTime: "",
      riderId: "",
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: RideRequestFormData) => {
      const payload = {
        ...data,
        preferredTime: timeToTodayTimestamp(data.preferredTime),
        // Don't send riderId if it's "self" or empty, let server use current user
        riderId: data.riderId === "self" || !data.riderId ? undefined : data.riderId,
      };
      return await apiRequest("POST", "/api/ride-requests", payload);
    },
    onSuccess: () => {
      toast({
        title: "تم تقديم طلب الرحلة",
        description: "تم تقديم طلب الرحلة. سيتم إخطار السائقين!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ride-requests/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ride-requests/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ride-requests"] });
      onClose();
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في تقديم طلب الرحلة",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RideRequestFormData) => {
    createRequestMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-3 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="responsive-text-lg">طلب رحلة</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
              <FormField
                control={form.control}
                name="fromLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>من</FormLabel>
                    <FormControl>
                      <Input placeholder="موقع الانطلاق" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="toLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>إلى</FormLabel>
                    <FormControl>
                      <Input placeholder="الوجهة" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="preferredTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الوقت المفضل</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {user?.role === 'admin' && (
              <FormField
                control={form.control}
                name="riderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>طلب للمستخدم</FormLabel>
                    <FormControl>
                      <SearchableUserSelect
                        users={Array.isArray(users) ? users : []}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="اختر مستخدماً (اتركه فارغاً لنفسك)"
                        allowSelf={true}
                        selfLabel="نفسي (المدير)"
                        selfValue="self"
                        showRole={false}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            

            

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                إلغاء
              </Button>
              <Button type="submit" disabled={createRequestMutation.isPending}>
                {createRequestMutation.isPending ? "جاري الإرسال..." : "طلب رحلة"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
