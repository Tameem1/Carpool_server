import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const rideRequestFormSchema = z.object({
  fromLocation: z.string().min(1, "موقع الانطلاق مطلوب"),
  toLocation: z.string().min(1, "الوجهة مطلوبة"),
  preferredTime: z.string().min(1, "الوقت المفضل مطلوب"),
  passengerCount: z.number().min(1, "راكب واحد على الأقل مطلوب").max(4, "4 ركاب كحد أقصى"),
  notes: z.string().optional(),
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
      passengerCount: 1,
      notes: "",
      riderId: "",
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: RideRequestFormData) => {
      const payload = {
        ...data,
        preferredTime: new Date(data.preferredTime).toISOString(),
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>طلب رحلة</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="fromLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
                    <FormControl>
                      <Input placeholder="Pickup location" {...field} />
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
                    <FormLabel>To</FormLabel>
                    <FormControl>
                      <Input placeholder="Destination" {...field} />
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
                  <FormLabel>Preferred Date & Time</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
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
                    <FormLabel>Request for User</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a user (leave empty for yourself)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="self">Myself (Admin)</SelectItem>
                        {users.map((user: any) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="passengerCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Passengers</FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select passenger count" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[1, 2, 3, 4].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} passenger{num > 1 ? 's' : ''}
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Requirements</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any special requirements or notes..." 
                      rows={3} 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRequestMutation.isPending}>
                {createRequestMutation.isPending ? "Submitting..." : "Request Ride"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
