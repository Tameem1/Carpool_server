import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const tripFormSchema = z.object({
  fromLocation: z.string().min(1, "Pickup location is required"),
  toLocation: z.string().min(1, "Destination is required"),
  departureTime: z.string().min(1, "Date and time are required"),
  availableSeats: z.number().min(1, "At least 1 seat required").max(8, "Maximum 8 seats"),
  isRecurring: z.boolean().default(false),
  recurringDays: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

type TripFormData = z.infer<typeof tripFormSchema>;

interface TripFormProps {
  open: boolean;
  onClose: () => void;
  trip?: any; // For editing existing trips
}

const daysOfWeek = [
  { id: "monday", label: "Monday" },
  { id: "tuesday", label: "Tuesday" },
  { id: "wednesday", label: "Wednesday" },
  { id: "thursday", label: "Thursday" },
  { id: "friday", label: "Friday" },
  { id: "saturday", label: "Saturday" },
  { id: "sunday", label: "Sunday" },
];

export function TripForm({ open, onClose, trip }: TripFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const form = useForm<TripFormData>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: {
      fromLocation: trip?.fromLocation || "",
      toLocation: trip?.toLocation || "",
      departureTime: trip?.departureTime ? new Date(trip.departureTime).toISOString().slice(0, 16) : "",
      availableSeats: trip?.availableSeats || 1,
      pricePerSeat: trip?.pricePerSeat ? trip.pricePerSeat / 100 : 10,
      isRecurring: trip?.isRecurring || false,
      notes: trip?.notes || "",
    },
  });

  const createTripMutation = useMutation({
    mutationFn: async (data: TripFormData) => {
      const payload = {
        ...data,
        departureTime: new Date(data.departureTime).toISOString(),
        pricePerSeat: Math.round(data.pricePerSeat * 100), // Convert to cents
        recurringDays: data.isRecurring ? JSON.stringify(selectedDays) : null,
      };

      if (trip) {
        return await apiRequest("PATCH", `/api/trips/${trip.id}`, payload);
      } else {
        return await apiRequest("POST", "/api/trips", payload);
      }
    },
    onSuccess: () => {
      toast({
        title: trip ? "Trip Updated" : "Trip Created",
        description: trip ? "Your trip has been updated successfully." : "Your trip has been created successfully. Notifications sent!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips/my"] });
      onClose();
      form.reset();
      setSelectedDays([]);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save trip",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TripFormData) => {
    createTripMutation.mutate(data);
  };

  const handleDayToggle = (dayId: string, checked: boolean) => {
    if (checked) {
      setSelectedDays([...selectedDays, dayId]);
    } else {
      setSelectedDays(selectedDays.filter(d => d !== dayId));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{trip ? "Edit Trip" : "Create New Trip"}</DialogTitle>
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
              name="departureTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Departure Date & Time</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="availableSeats"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Seats</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select seats" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} seat{num > 1 ? 's' : ''}
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
                name="pricePerSeat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per seat ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        min="0.01"
                        placeholder="10.00" 
                        {...field} 
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isRecurring"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox 
                      checked={field.value} 
                      onCheckedChange={field.onChange} 
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Recurring Schedule
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Create this trip on multiple days of the week
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {form.watch("isRecurring") && (
              <div>
                <FormLabel>Select Days</FormLabel>
                <div className="flex flex-wrap gap-2 mt-2">
                  {daysOfWeek.map((day) => (
                    <label key={day.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={selectedDays.includes(day.id)}
                        onCheckedChange={(checked) => handleDayToggle(day.id, checked as boolean)}
                      />
                      <span className="text-sm">{day.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any additional information about the trip..." 
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
              <Button type="submit" disabled={createTripMutation.isPending}>
                {createTripMutation.isPending ? "Saving..." : (trip ? "Update Trip" : "Create Trip")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
