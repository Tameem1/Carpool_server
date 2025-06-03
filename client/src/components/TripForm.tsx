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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const tripFormSchema = z.object({
  fromLocation: z.string().min(1, "Pickup location is required"),
  toLocation: z.string().min(1, "Destination is required"),
  departureTime: z.string().min(1, "Date and time are required"),
  availableSeats: z.number().min(1, "At least 1 seat required").max(8, "Maximum 8 seats"),
  isRecurring: z.boolean().default(false),
  recurringDays: z.array(z.string()).optional(),
  notes: z.string().optional(),
  driverId: z.string().optional(),
  participantIds: z.array(z.string()).optional(),
});

type TripFormData = z.infer<typeof tripFormSchema>;

interface TripFormProps {
  open: boolean;
  onClose: () => void;
  trip?: any;
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
  const { user } = useAuth();
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const isAdmin = user?.role === 'admin';

  // Fetch users for admin
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    enabled: isAdmin,
  });

  const form = useForm<TripFormData>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: {
      fromLocation: trip?.fromLocation || "",
      toLocation: trip?.toLocation || "",
      departureTime: trip?.departureTime ? new Date(trip.departureTime).toISOString().slice(0, 16) : "",
      availableSeats: trip?.availableSeats || 1,
      isRecurring: trip?.isRecurring || false,
      recurringDays: trip?.recurringDays || [],
      notes: trip?.notes || "",
      driverId: trip?.driverId || "",
      participantIds: [],
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: TripFormData) => {
      const payload = {
        ...data,
        participantIds: selectedParticipants,
        departureTime: new Date(data.departureTime).toISOString(),
      };
      
      if (trip?.id) {
        return await fetch(`/api/trips/${trip.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(res => {
          if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
          return res.json();
        });
      } else {
        return await fetch("/api/trips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(res => {
          if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
          return res.json();
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-trips"] });
      toast({
        title: "Success",
        description: trip?.id ? "Trip updated successfully!" : "Trip created successfully!",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TripFormData) => {
    mutation.mutate(data);
  };

  const handleDayToggle = (dayId: string) => {
    const newDays = selectedDays.includes(dayId)
      ? selectedDays.filter(d => d !== dayId)
      : [...selectedDays, dayId];
    setSelectedDays(newDays);
    form.setValue('recurringDays', newDays);
  };

  const handleParticipantAdd = (userId: string) => {
    if (!selectedParticipants.includes(userId)) {
      setSelectedParticipants([...selectedParticipants, userId]);
    }
  };

  const handleParticipantRemove = (userId: string) => {
    setSelectedParticipants(selectedParticipants.filter(id => id !== userId));
  };

  const getSelectedUser = (userId: string) => {
    return users.find((u: any) => u.id === userId);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{trip?.id ? "Edit Trip" : "Create New Trip"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <FormField
                control={form.control}
                name="availableSeats"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Seats</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="8"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isAdmin && (
              <FormField
                control={form.control}
                name="driverId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Driver</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a driver" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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

            {isAdmin && (
              <div>
                <FormLabel>Assign Participants</FormLabel>
                <div className="mt-2">
                  <Select onValueChange={handleParticipantAdd}>
                    <SelectTrigger>
                      <SelectValue placeholder="Add participant" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter((user: any) => !selectedParticipants.includes(user.id))
                        .map((user: any) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName} ({user.email})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedParticipants.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedParticipants.map((userId) => {
                        const user = getSelectedUser(userId);
                        return (
                          <Badge key={userId} variant="secondary" className="flex items-center gap-1">
                            {user?.firstName} {user?.lastName}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={() => handleParticipantRemove(userId)}
                            />
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

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
                    <FormLabel>Recurring Trip</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {form.watch('isRecurring') && (
              <div>
                <FormLabel>Select Days</FormLabel>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {daysOfWeek.map((day) => (
                    <div key={day.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={day.id}
                        checked={selectedDays.includes(day.id)}
                        onCheckedChange={() => handleDayToggle(day.id)}
                      />
                      <label htmlFor={day.id} className="text-sm font-medium">
                        {day.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional information..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : trip?.id ? "Update Trip" : "Create Trip"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}