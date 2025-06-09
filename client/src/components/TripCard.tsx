import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Clock,
  Users,
  Star,
  Car,
  UserPlus,
  UserMinus,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TripCardProps {
  trip: {
    id: number;
    fromLocation: string;
    toLocation: string;
    departureTime: string;
    availableSeats: number;
    totalSeats: number;
    riders?: string[];
    riderDetails?: {
      id: string;
      firstName: string;
      lastName: string;
      profileImageUrl?: string;
    }[];

    driver?: {
      id: string;
      firstName: string;
      lastName: string;
      profileImageUrl?: string;
    };
    participantCount?: number;
    status: string;
  };
  onRequestSeat?: (tripId: number) => void;
  onEdit?: (tripId: number) => void;
  onCancel?: (tripId: number) => void;
  showActions?: boolean;
  userRole?: string;
  currentUserId?: string;
}

// Utility function to detect Arabic text
function isArabicText(text: string): boolean {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F]/;
  return arabicRegex.test(text);
}

// Utility function to format route display with proper direction
function formatRoute(fromLocation: string, toLocation: string): string {
  const isFromArabic = isArabicText(fromLocation);
  const isToArabic = isArabicText(toLocation);
  
  // If either location contains Arabic text, maintain logical order but use RTL arrow
  if (isFromArabic || isToArabic) {
    return `${fromLocation} ← ${toLocation}`;
  }
  
  // Default LTR formatting for non-Arabic text
  return `${fromLocation} → ${toLocation}`;
}

export function TripCard({
  trip,
  onRequestSeat,
  onEdit,
  onCancel,
  showActions = true,
  userRole,
  currentUserId,
}: TripCardProps) {
  const departureDate = new Date(trip.departureTime);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all users for the dropdown (admin only)
  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    enabled: userRole === "admin",
  });

  // Add rider mutation
  const addRiderMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/trips/${trip.id}/riders`, {
        method: "POST",
        body: JSON.stringify({ userId }),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add rider");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({
        title: "Success",
        description: "Rider added to trip successfully",
      });
      setSelectedUserId("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add rider to trip",
        variant: "destructive",
      });
    },
  });

  // Remove rider mutation
  const removeRiderMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/trips/${trip.id}/riders/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to remove rider");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({
        title: "Success",
        description: "Rider removed from trip successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove rider from trip",
        variant: "destructive",
      });
    },
  });

  // Join trip mutation
  const joinTripMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/trips/${trip.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to join trip");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips/my"] });
      toast({
        title: "Success",
        description: "Successfully joined the trip!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join trip",
        variant: "destructive",
      });
    },
  });

  // Delete trip mutation
  const deleteTripMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/trips/${trip.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete trip");
      }
      return response.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({
        title: "Success",
        description: "Trip deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete trip",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success/20 text-success";
      case "completed":
        return "bg-gray-100 text-gray-600";
      case "cancelled":
        return "bg-destructive/20 text-destructive";
      default:
        return "bg-warning/20 text-warning";
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow relative">
      <CardContent className="p-3 sm:p-6">
        {/* Delete button in top-right corner for admin */}
        {userRole === "admin" && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 touch-friendly"
            onClick={() => deleteTripMutation.mutate()}
            disabled={deleteTripMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 space-y-2 sm:space-y-0">
          <div className="flex-1">
            <h3 className={`responsive-text-lg font-semibold text-gray-900 dark:text-white ${(isArabicText(trip.fromLocation) || isArabicText(trip.toLocation)) ? 'text-right' : 'text-left'}`}>
              {formatRoute(trip.fromLocation, trip.toLocation)}
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex items-center mt-1">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="truncate">{format(departureDate, "MMM d, yyyy 'at' h:mm a")}</span>
            </p>
          </div>
          <Badge className={`${getStatusColor(trip.status)} text-xs sm:text-sm`}>{trip.status}</Badge>
        </div>

        {trip.driver && (
          <div className="flex items-center mb-3 sm:mb-4">
            <Avatar className="h-8 w-8 sm:h-10 sm:w-10 mr-2 sm:mr-3">
              <AvatarImage
                src={trip.driver.profileImageUrl || ""}
                alt="Driver"
              />
              <AvatarFallback className="text-xs sm:text-sm">
                {trip.driver.firstName[0]}
                {trip.driver.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                {trip.driver.firstName} {trip.driver.lastName}
              </p>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Driver</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-4">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">الانطلاق</p>
            <p className="font-medium text-sm sm:text-base truncate">{trip.fromLocation}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">الوصول</p>
            <p className="font-medium text-sm sm:text-base truncate">{trip.toLocation}</p>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">الركاب</p>
            <p className="font-medium text-sm sm:text-base flex items-center">
              <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              {trip.riders?.length || 0} / {trip.totalSeats}
            </p>
          </div>
        </div>

        {trip.riderDetails && trip.riderDetails.length > 0 && (
          <div className="mb-3 sm:mb-4">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">الركاب الحاليين</p>
            <div className="flex flex-wrap gap-1 sm:gap-2">
              {trip.riderDetails.map((rider) => (
                <div key={rider.id} className="relative group">
                  <Badge variant="secondary" className="text-xs pr-4 sm:pr-6 py-1">
                    {rider.firstName} {rider.lastName}
                  </Badge>
                  {userRole === "admin" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 p-0 rounded-full bg-red-100 hover:bg-red-200 opacity-0 group-hover:opacity-100 transition-opacity touch-friendly"
                      onClick={() => removeRiderMutation.mutate(rider.id)}
                      disabled={removeRiderMutation.isPending}
                    >
                      <UserMinus className="h-2 w-2 sm:h-3 sm:w-3 text-red-600" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {userRole === "admin" && users && (
          <div className="mb-3 sm:mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">أضف راكب للرحلة</p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1 bg-white dark:bg-gray-700 text-sm touch-friendly">
                  <SelectValue placeholder="اختر مستخدم..." />
                </SelectTrigger>
                <SelectContent>
                  {(users as any[])
                    ?.filter(
                      (user: any) =>
                        !trip.riders?.includes(user.id) &&
                        (trip.riders?.length || 0) < trip.totalSeats
                    )
                    .map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.role === 'admin' ? 'مدير' : user.role === 'driver' ? 'سائق' : 'راكب'})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="touch-friendly w-full sm:w-auto bg-[#16b7a4] hover:bg-[#14a085] text-white"
                onClick={() =>
                  selectedUserId && addRiderMutation.mutate(selectedUserId)
                }
                disabled={
                  !selectedUserId ||
                  addRiderMutation.isPending ||
                  (trip.riders?.length || 0) >= trip.totalSeats
                }
              >
                <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                {addRiderMutation.isPending ? "..." : "إضافة"}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="flex items-center">
            <div className="flex items-center text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              <span>
                {trip.totalSeats - (trip.riders?.length || 0)} seats available
              </span>
            </div>
          </div>

          {showActions && (
            <div className="flex flex-wrap gap-2">
              {/* Request Seat button - for non-admin users */}
              {userRole === "rider" &&
                onRequestSeat &&
                trip.availableSeats > 0 &&
                currentUserId !== trip.driver?.id &&
                !trip.riders?.includes(currentUserId || "") && (
                  <Button
                    onClick={() => onRequestSeat(trip.id)}
                    className="bg-[#16b7a4] hover:bg-[#14a085] text-white touch-friendly"
                    size="sm"
                  >
                    طلب مقعد
                  </Button>
                )}

              {/* Already joined indicator */}
              {currentUserId && trip.riders?.includes(currentUserId) && (
                <Button
                  disabled
                  variant="outline"
                  className="border-green-500 text-green-600 text-xs sm:text-sm"
                  size="sm"
                >
                  مشترك بالفعل
                </Button>
              )}

              {/* Edit and Cancel buttons for driver/admin */}
              {(userRole === "driver" || userRole === "admin") && onEdit && (
                <Button 
                  variant="outline" 
                  onClick={() => onEdit(trip.id)}
                  size="sm"
                  className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 text-xs sm:text-sm touch-friendly"
                >
                  تعديل
                </Button>
              )}
              {(userRole === "driver" || userRole === "admin") && onCancel && (
                <Button 
                  variant="outline" 
                  onClick={() => onCancel(trip.id)}
                  size="sm"
                  className="border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900 text-xs sm:text-sm touch-friendly"
                >
                  إلغاء
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
