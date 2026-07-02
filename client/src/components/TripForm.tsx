import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableUserSelect } from "@/components/ui/searchable-user-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, UserMinus, UserPlus } from "lucide-react";
import {
  formatDateForInput,
  nowGMTPlus3,
  parseTimeToTodayUTC,
  extractTimeFromUTC,
} from "@shared/timezone";

const tripFormSchema = z.object({
  fromLocation: z.string().min(1, "موقع الانطلاق مطلوب"),
  toLocation: z.string().min(1, "الوجهة مطلوبة"),
  departureTime: z.string().min(1, "الوقت مطلوب"),
  availableSeats: z
    .number()
    .min(1, "مقعد واحد على الأقل مطلوب")
    .max(6, "6 مقاعد كحد أقصى"),
  isRecurring: z.boolean().default(false),
  recurringDays: z.array(z.string()).optional(),
  driverId: z.string().optional(),
  participantIds: z.array(z.string()).optional(),
});

type TripFormData = z.infer<typeof tripFormSchema>;

interface TripFormProps {
  open: boolean;
  onClose: () => void;
  trip?: any;
}

export function TripForm({ open, onClose, trip }: TripFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    [],
  );
  const [currentRiders, setCurrentRiders] = useState<string[]>([]);
  const [addReturnTrip, setAddReturnTrip] = useState(false);
  const [returnDepartureTime, setReturnDepartureTime] = useState("");
  const [returnTimeMode, setReturnTimeMode] = useState("custom");
  const [returnFromLocation, setReturnFromLocation] = useState("");
  const [returnToLocation, setReturnToLocation] = useState("");
  const [returnTimeOption, setReturnTimeOption] = useState("custom");
  const isAdmin = user?.role === "admin";

  // Fetch users for admin
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
  });

  // Initialize form data when trip changes
  useEffect(() => {
    if (trip) {
      setCurrentRiders(trip.riders || []);
      setSelectedParticipants([]);
    } else {
      setCurrentRiders([]);
      setSelectedParticipants([]);
    }
    // Reset return trip state whenever the dialog target changes
    setAddReturnTrip(false);
    setReturnDepartureTime("");
  }, [trip]);

  const form = useForm<TripFormData>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: {
      fromLocation: trip?.fromLocation || "",
      toLocation: trip?.toLocation || "النادي",
      departureTime: trip?.departureTime
        ? extractTimeFromUTC(new Date(trip.departureTime))
        : "",
      availableSeats: trip?.availableSeats || 1,
      isRecurring: trip?.isRecurring || false,
      recurringDays: trip?.recurringDays || [],
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
        departureTime: trip.departureTime
          ? extractTimeFromUTC(new Date(trip.departureTime))
          : "",
        availableSeats: trip.availableSeats || 4,
        isRecurring: trip.isRecurring || false,
        recurringDays: trip.recurringDays || [],
        driverId: trip.driverId || "",
        participantIds: [],
      });
    } else {
      form.reset({
        fromLocation: "",
        toLocation: "النادي",
        departureTime: "",
        availableSeats: 4,
        isRecurring: false,
        recurringDays: [],
        driverId: "",
        participantIds: [],
      });
    }
  }, [trip, form]);

  const addRiderMutation = useMutation({
    mutationFn: async ({
      tripId,
      userId,
    }: {
      tripId: number;
      userId: string;
    }) => {
      return await apiRequest("POST", `/api/trips/${tripId}/riders`, {
        userId,
      });
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
    mutationFn: async ({
      tripId,
      userId,
    }: {
      tripId: number;
      userId: string;
    }) => {
      return await apiRequest(
        "DELETE",
        `/api/trips/${tripId}/riders/${userId}`,
      );
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
      const payload: any = {
        ...data,
        totalSeats: data.availableSeats, // Automatically set totalSeats to match availableSeats
        participantIds: selectedParticipants,
        departureTime: parseTimeToTodayUTC(data.departureTime).toISOString(),
        riders: trip?.id ? undefined : selectedParticipants, // Only set riders for new trips
      };

      // Attach return trip data when the toggle is on (new trips only)
      if (!trip?.id && addReturnTrip) {
        // Map the selected time mode to the returnTimeType value sent to the server.
        // For first_last / second_last the server resolves the actual time itself;
        // for custom we must provide the ISO departure time.
        if (returnTimeMode === "first") {
          payload.returnTrip = {
            returnTimeType: "first_last",
            fromLocation: returnFromLocation || data.toLocation,
            toLocation: returnToLocation || data.fromLocation,
          };
        } else if (returnTimeMode === "second") {
          payload.returnTrip = {
            returnTimeType: "second_last",
            fromLocation: returnFromLocation || data.toLocation,
            toLocation: returnToLocation || data.fromLocation,
          };
        } else if (returnTimeMode === "custom" && returnDepartureTime) {
          payload.returnTrip = {
            returnTimeType: "custom",
            departureTime: parseTimeToTodayUTC(returnDepartureTime).toISOString(),
            fromLocation: returnFromLocation || data.toLocation,
            toLocation: returnToLocation || data.fromLocation,
          };
        }
      }

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
        description: trip?.id
          ? "تم تحديث الرحلة بنجاح!"
          : "تم إنشاء الرحلة بنجاح!",
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
    // Guard: if return trip is enabled in custom mode, a time must be entered
    if (!trip?.id && addReturnTrip && returnTimeMode === "custom" && !returnDepartureTime) {
      toast({
        title: "يرجى إدخال وقت العودة",
        description: "الرجاء تحديد وقت انطلاق رحلة العودة أو اختيار خيار آخر",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(data);
  };

  const handleParticipantAdd = (userId: string) => {
    if (!selectedParticipants.includes(userId)) {
      setSelectedParticipants([...selectedParticipants, userId]);
    }
  };

  const handleParticipantRemove = (userId: string) => {
    setSelectedParticipants(selectedParticipants.filter((id) => id !== userId));
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
      setCurrentRiders(currentRiders.filter((id) => id !== userId));
    }
  };

  const getSelectedUser = (userId: string) => {
    return users.find((u: any) => u.id === userId);
  };

  const getCurrentRiders = () => {
    return currentRiders
      .map((riderId) => users.find((u: any) => u.id === riderId))
      .filter(Boolean);
  };

  const getAvailableUsers = () => {
    const excludedIds = [
      ...currentRiders,
      ...(trip?.driverId ? [trip.driverId] : []),
    ];
    return users.filter((user: any) => !excludedIds.includes(user.id));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-3 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="responsive-text-lg">
            {trip?.id ? "تحرير الرحلة" : "إنشاء رحلة جديدة"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 sm:space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <FormField
                control={form.control}
                name="fromLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">من</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="موقع الانطلاق"
                        className="touch-friendly"
                        {...field}
                      />
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
                      <Input
                        placeholder="الوجهة"
                        className="touch-friendly"
                        {...field}
                      />
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
                  <FormLabel className="text-sm">وقت الانطلاق</FormLabel>
                  <FormControl>
                    <Input type="time" className="touch-friendly" {...field} />
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
                  <FormLabel className="text-sm">عدد المقاعد المتاحة</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="6"
                      className="touch-friendly"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 1)
                      }
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

            {(isAdmin || trip?.driverId === user?.id) && trip?.id && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    إدارة الركاب الحاليين
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {getCurrentRiders().length > 0 ? (
                      <div>
                        <h4 className="font-medium mb-3">الركاب الحاليون:</h4>
                        <div className="space-y-2">
                          {getCurrentRiders().map((rider: any) => (
                            <div
                              key={rider.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center space-x-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage
                                    src={rider.profileImageUrl || ""}
                                  />
                                  <AvatarFallback>
                                    {rider.username?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">
                                    {rider.username}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {rider.section}
                                  </div>
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
                      <p className="text-gray-500 text-center py-4">
                        لا يوجد ركاب حالياً
                      </p>
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
                          <Badge
                            key={userId}
                            variant="secondary"
                            className="flex items-center gap-1"
                          >
                            {user?.username}
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

            {/* Return trip toggle — only visible when creating a new trip */}
            {!trip?.id && (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">إضافة رحلة عودة</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      إنشاء رحلة عودة مرتبطة بنفس المقاعد
                    </p>
                  </div>
                  <Switch
                    checked={addReturnTrip}
                    onCheckedChange={(checked) => {
                      setAddReturnTrip(checked);

                      if (checked) {
                        setReturnFromLocation(form.getValues("toLocation"));
                        setReturnToLocation(form.getValues("fromLocation"));
                      }
                    }}
                  />
                </div>

                {addReturnTrip && (
                  <div className="space-y-3 pt-1">
                    {/* Read-only swapped route preview */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium">من</label>
                        <Input
                          className="touch-friendly"
                          value={returnFromLocation}
                          onChange={(e) => setReturnFromLocation(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">إلى</label>
                        <Input
                          className="touch-friendly"
                          value={returnToLocation}
                          onChange={(e) => setReturnToLocation(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">

                      <label className="text-sm font-medium">
                        طريقة انطلاق العودة
                      </label>

                      <div className="space-y-2">

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={returnTimeMode === "first"}
                            onChange={() => setReturnTimeMode("first")}
                          />
                          <span>آخر شيء أول</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={returnTimeMode === "second"}
                            onChange={() => setReturnTimeMode("second")}
                          />
                          <span>آخر شيء ثاني</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={returnTimeMode === "custom"}
                            onChange={() => setReturnTimeMode("custom")}
                          />
                          <span>وقت معين</span>
                        </label>

                      </div>

                      {returnTimeMode === "custom" && (
                        <div className="space-y-1">
                          <label className="text-sm font-medium">
                            وقت انطلاق العودة
                          </label>

                          <Input
                            type="time"
                            className="touch-friendly"
                            value={returnDepartureTime}
                            onChange={(e) => setReturnDepartureTime(e.target.value)}
                          />
                        </div>
                      )}

                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                إلغاء
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending
                  ? "جاري الحفظ..."
                  : trip?.id
                    ? "تحديث الرحلة"
                    : "إنشاء رحلة"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
