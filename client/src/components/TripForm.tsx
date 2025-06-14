import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableUserSelect } from "@/components/ui/searchable-user-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, UserMinus, UserPlus } from "lucide-react";
import { formatDateForInput, nowGMTPlus3, parseDateTimeLocalToUTC } from "@shared/timezone";

const tripFormSchema = z.object({
  fromLocation: z.string().min(1, "موقع الانطلاق مطلوب"),
  toLocation: z.string().min(1, "الوجهة مطلوبة"),
  departureTime: z.string().min(1, "التاريخ والوقت مطلوبان"),
  availableSeats: z.number().min(1, "مقعد واحد على الأقل مطلوب").max(8, "8 مقاعد كحد أقصى"),
  totalSeats: z.number().min(1, "مقعد واحد على الأقل مطلوب").max(8, "8 مقاعد كحد أقصى"),
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
  { id: "monday", label: "الاثنين" },
  { id: "tuesday", label: "الثلاثاء" },
  { id: "wednesday", label: "الأربعاء" },
  { id: "thursday", label: "الخميس" },
  { id: "friday", label: "الجمعة" },
  { id: "saturday", label: "السبت" },
  { id: "sunday", label: "الأحد" },
];

export function TripForm({ open, onClose, trip }: TripFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [currentRiders, setCurrentRiders] = useState<string[]>([]);

  const isAdmin = user?.role === 'admin';

  // Fetch users for admin
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    enabled: isAdmin,
  });

  // Initialize form data when trip changes
  useEffect(() => {
    if (trip) {
      setSelectedDays(trip.recurringDays || []);
      setCurrentRiders(trip.riders || []);
      setSelectedParticipants([]);
    } else {
      setSelectedDays([]);
      setCurrentRiders([]);
      setSelectedParticipants([]);
    }
  }, [trip]);

  const form = useForm<TripFormData>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: {
      fromLocation: trip?.fromLocation || "",
      toLocation: trip?.toLocation || "النادي",
      departureTime: trip?.departureTime ? formatDateForInput(new Date(trip.departureTime)) : "",
      availableSeats: trip?.availableSeats || 1,
      totalSeats: trip?.totalSeats || trip?.availableSeats || 1,
      isRecurring: trip?.isRecurring || false,
      recurringDays: trip?.recurringDays || [],
      notes: trip?.notes || "",
      driverId: trip?.driverId || "",
      participantIds: [],
    },
  });

  // Reset form when trip changes
  useEffect(() => {
    if (trip) {
      form.reset({
        fromLocation: trip.fromLocation || "",
        toLocation: trip.toLocation || "النادي",
        departureTime: trip.departureTime ? formatDateForInput(new Date(trip.departureTime)) : "",
        availableSeats: trip.availableSeats || 1,
        totalSeats: trip.totalSeats || trip.availableSeats || 1,
        isRecurring: trip.isRecurring || false,
        recurringDays: trip.recurringDays || [],
        notes: trip.notes || "",
        driverId: trip.driverId || "",
        participantIds: [],
      });
    } else {
      form.reset({
        fromLocation: "",
        toLocation: "النادي",
        departureTime: "",
        availableSeats: 1,
        totalSeats: 1,
        isRecurring: false,
        recurringDays: [],
        notes: "",
        driverId: "",
        participantIds: [],
      });
    }
  }, [trip, form]);

  const addRiderMutation = useMutation({
    mutationFn: async ({ tripId, userId }: { tripId: number; userId: string }) => {
      return await apiRequest("POST", `/api/trips/${tripId}/riders`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({
        title: "تمت الإضافة",
        description: "تم إضافة الراكب بنجاح",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إضافة الراكب",
        variant: "destructive",
      });
    },
  });

  const removeRiderMutation = useMutation({
    mutationFn: async ({ tripId, userId }: { tripId: number; userId: string }) => {
      return await apiRequest("DELETE", `/api/trips/${tripId}/riders/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({
        title: "تمت الإزالة",
        description: "تم إزالة الراكب بنجاح",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إزالة الراكب",
        variant: "destructive",
      });
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: TripFormData) => {
      const payload = {
        ...data,
        participantIds: selectedParticipants,
        departureTime: parseDateTimeLocalToUTC(data.departureTime).toISOString(),
        riders: trip?.id ? undefined : selectedParticipants, // Only set riders for new trips
      };
      
      if (trip?.id) {
        return await apiRequest("PATCH", `/api/trips/${trip.id}`, payload);
      } else {
        return await apiRequest("POST", "/api/trips", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-trips"] });
      toast({
        title: "نجحت العملية",
        description: trip?.id ? "تم تحديث الرحلة بنجاح!" : "تم إنشاء الرحلة بنجاح!",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ ما",
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

  const handleRiderAdd = async (userId: string) => {
    if (trip?.id) {
      await addRiderMutation.mutateAsync({ tripId: trip.id, userId });
      setCurrentRiders([...currentRiders, userId]);
    }
  };

  const handleRiderRemove = async (userId: string) => {
    if (trip?.id) {
      await removeRiderMutation.mutateAsync({ tripId: trip.id, userId });
      setCurrentRiders(currentRiders.filter(id => id !== userId));
    }
  };

  const getSelectedUser = (userId: string) => {
    return users.find((u: any) => u.id === userId);
  };

  const getCurrentRiders = () => {
    return currentRiders.map(riderId => users.find((u: any) => u.id === riderId)).filter(Boolean);
  };

  const getAvailableUsers = () => {
    const excludedIds = [...currentRiders, ...(trip?.driverId ? [trip.driverId] : [])];
    return users.filter((user: any) => !excludedIds.includes(user.id));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-3 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="responsive-text-lg">{trip?.id ? "تحرير الرحلة" : "إنشاء رحلة جديدة"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <FormField
                control={form.control}
                name="fromLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">من</FormLabel>
                    <FormControl>
                      <Input placeholder="موقع الانطلاق" className="touch-friendly" {...field} />
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
                    <FormLabel className="text-sm">إلى</FormLabel>
                    <FormControl>
                      <Input placeholder="الوجهة" className="touch-friendly" {...field} />
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
                  <FormLabel className="text-sm">تاريخ ووقت الانطلاق</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" className="touch-friendly" {...field} />
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
                  <FormLabel className="text-sm">المقاعد المتاحة</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="8"
                      className="touch-friendly"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isAdmin && (
              <FormField
                control={form.control}
                name="driverId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">اختر السائق</FormLabel>
                    <FormControl>
                      <SearchableUserSelect
                        users={users}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="اختر سائقاً"
                        showRole={false}
                        className="touch-friendly"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {isAdmin && trip?.id && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">إدارة الركاب الحاليين</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {getCurrentRiders().length > 0 ? (
                      <div>
                        <h4 className="font-medium mb-3">الركاب الحاليون:</h4>
                        <div className="space-y-2">
                          {getCurrentRiders().map((rider: any) => (
                            <div key={rider.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center space-x-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={rider.profileImageUrl || ""} />
                                  <AvatarFallback>
                                    {rider.firstName?.[0]}{rider.lastName?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{rider.firstName} {rider.lastName}</div>
                                  <div className="text-sm text-gray-500">{rider.email}</div>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRiderRemove(rider.id)}
                                disabled={removeRiderMutation.isPending}
                                className="text-red-600 hover:text-red-700"
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">لا يوجد ركاب حالياً</p>
                    )}

                    <div>
                      <h4 className="font-medium mb-3">إضافة راكب جديد:</h4>
                      <SearchableUserSelect
                        users={getAvailableUsers()}
                        value=""
                        onValueChange={(value) => { 
                          if (value) {
                            handleRiderAdd(value);
                          }
                        }}
                        placeholder="اختر راكباً لإضافته"
                        showRole={false}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {isAdmin && !trip?.id && (
              <div>
                <FormLabel>تعيين المشاركين (للرحلات الجديدة)</FormLabel>
                <div className="mt-2">
                  <SearchableUserSelect
                    users={users}
                    value=""
                    onValueChange={(value) => { 
                      if (value) {
                        handleParticipantAdd(value);
                      }
                    }}
                    placeholder="إضافة مشارك"
                    excludeUserIds={selectedParticipants}
                    showRole={false}
                  />
                  
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
                    <FormLabel>رحلة متكررة</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {form.watch('isRecurring') && (
              <div>
                <FormLabel>اختر الأيام</FormLabel>
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
                  <FormLabel>ملاحظات (اختيارية)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="معلومات إضافية..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                إلغاء
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "جاري الحفظ..." : trip?.id ? "تحديث الرحلة" : "إنشاء رحلة"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}