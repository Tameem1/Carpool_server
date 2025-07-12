import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SearchableUserSelect } from "@/components/ui/searchable-user-select";
import {
  MapPin,
  Clock,
  Users,
  Star,
  Car,
  UserPlus,
  UserMinus,
  Trash2,
  Phone,
} from "lucide-react";
import { format } from "date-fns";
import { formatGMTPlus3, formatGMTPlus3TimeOnly } from "@shared/timezone";
import { useState } from "react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TripJoinRequestForm } from "./TripJoinRequestForm";

// Helper function to extract and format time from timestamp with GMT+3 timezone
function formatTimeOnly(timestamp: string): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return formatGMTPlus3TimeOnly(date, 'en-US'); // Use English format for website display
}

interface TripCardProps {
  trip: {
    id: number;
    driverId?: string;
    fromLocation: string;
    toLocation: string;
    departureTime: string;
    availableSeats: number;
    totalSeats: number;
    riders?: string[];
    riderDetails?: {
      id: string;
      username: string;
      section: string;
      role?: string;
      profileImageUrl?: string;
      phoneNumber?: string;
    }[];

    driver?: {
      id: string;
      username: string;
      section: string;
      role?: string;
      profileImageUrl?: string;
      phoneNumber?: string;
    };
    participantCount?: number;
  };
  onRequestSeat?: (tripId: number) => void;
  onEdit?: (tripId: number) => void;
  onCancel?: (tripId: number) => void;
  showActions?: boolean;
  userRole?: string;
  currentUserId?: string;
  hideJoinRequest?: boolean;
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
  hideJoinRequest = false,
}: TripCardProps) {
  const departureDate = new Date(trip.departureTime);
  const departureTimeOnly = formatTimeOnly(trip.departureTime);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [showJoinRequestForm, setShowJoinRequestForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all users for the dropdown (admin or driver of this trip)
  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: userRole === "admin" || trip.driverId === currentUserId,
  });

  // Add rider mutation
  const addRiderMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("POST", `/api/trips/${trip.id}/riders`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips/my"] });
      queryClient.refetchQueries({ queryKey: ["/api/trips"] });
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
      return await apiRequest("DELETE", `/api/trips/${trip.id}/riders/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips/my"] });
      queryClient.refetchQueries({ queryKey: ["/api/trips"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/trips/my"] });
      toast({
        title: "نجح الحذف",
        description: "تم حذف الرحلة بنجاح",
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



  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 sm:p-4 lg:p-6">

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 space-y-2 sm:space-y-0">
          <div className="flex-1">
            <h3 className={`responsive-text-lg font-semibold text-gray-900 dark:text-white ${(isArabicText(trip.fromLocation) || isArabicText(trip.toLocation)) ? 'text-right' : 'text-left'}`}>
              {formatRoute(trip.fromLocation, trip.toLocation)}
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex items-center mt-1">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="truncate">{departureTimeOnly}</span>
            </p>
          </div>

        </div>

        {trip.driver && (
          <div className="flex items-center mb-3 sm:mb-4">
            <Avatar className="h-8 w-8 sm:h-10 sm:w-10 mr-2 sm:mr-3">
              <AvatarImage
                src={trip.driver.profileImageUrl || ""}
                alt="Driver"
              />
              <AvatarFallback className="text-xs sm:text-sm">
                {trip.driver.username[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                {trip.driver.username}
              </p>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Driver</p>
              {trip.driver.phoneNumber ? (
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    <span>{trip.driver.phoneNumber}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 rounded-full bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800"
                    onClick={() => trip.driver?.phoneNumber && window.open(`tel:${trip.driver.phoneNumber}`, '_self')}
                    title={`Call ${trip.driver?.username || 'Driver'}`}
                  >
                    <Phone className="h-3 w-3 text-green-600" />
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                  لا يوجد رقم هاتف
                </span>
              )}
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
            <div className="space-y-2">
              {trip.riderDetails.map((rider) => (
                <div key={rider.id} className="relative group flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
                      <AvatarImage src={rider.profileImageUrl || ""} />
                      <AvatarFallback className="text-xs">
                        {rider.username?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-xs sm:text-sm font-medium">
                        {rider.username}
                      </span>
                      {rider.phoneNumber ? (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{rider.phoneNumber}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 rounded-full bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800"
                            onClick={() => window.open(`tel:${rider.phoneNumber}`, '_self')}
                            title={`Call ${rider.username}`}
                          >
                            <Phone className="h-3 w-3 text-green-600" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                          لا يوجد رقم هاتف
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 sm:space-x-2">

                    
                    {/* Remove rider button for admin or driver */}
                    {(userRole === "admin" || trip.driverId === currentUserId) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 sm:h-8 sm:w-8 p-0 rounded-full bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 touch-friendly"
                        onClick={() => removeRiderMutation.mutate(rider.id)}
                        disabled={removeRiderMutation.isPending}
                        title={`Remove ${rider.username}`}
                      >
                        <UserMinus className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(userRole === "admin" || trip.driverId === currentUserId) && users && Array.isArray(users) ? (
          <div className="mb-3 sm:mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border" data-add-rider-section>
            <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">أضف راكب للرحلة</p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <SearchableUserSelect
                users={users}
                value={selectedUserId}
                onValueChange={setSelectedUserId}
                placeholder="اختر مستخدم..."
                excludeUserIds={trip.riders || []}
                showRole={true}
                className="flex-1 bg-white dark:bg-gray-700 text-sm touch-friendly"
              />
              <Button
                size="sm"
                className="touch-friendly w-full sm:w-auto bg-[#16b7a4] hover:bg-[#14a085] text-white"
                onClick={() =>
                  selectedUserId && addRiderMutation.mutate(selectedUserId)
                }
                disabled={
                  !selectedUserId ||
                  addRiderMutation.isPending
                }
              >
                <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                {addRiderMutation.isPending ? "..." : "إضافة"}
              </Button>
            </div>
          </div>
        ) : null}

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
              {/* Join Trip button - for any user to directly join */}
              {!hideJoinRequest &&
                trip.availableSeats > 0 &&
                currentUserId !== trip.driver?.id &&
                !trip.riders?.includes(currentUserId || "") && (
                  <Button
                    onClick={() => setShowJoinRequestForm(true)}
                    variant="outline"
                    className="border-[#16b7a4] text-[#16b7a4] hover:bg-[#16b7a4] hover:text-white touch-friendly"
                    size="sm"
                  >
                    انضم للرحلة
                  </Button>
                )}

              {/* Request Seat button - fallback option */}
              {onRequestSeat &&
                trip.availableSeats > 0 &&
                currentUserId !== trip.driver?.id &&
                !trip.riders?.includes(currentUserId || "") && (
                  <Button
                    onClick={() => onRequestSeat(trip.id)}
                    variant="outline"
                    className="border-[#16b7a4] text-[#16b7a4] hover:bg-[#16b7a4] hover:text-white touch-friendly"
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



              {/* Edit and Cancel buttons for trip driver or admin */}
              {(trip.driverId === currentUserId || userRole === "admin") && onEdit && (
                <Button 
                  variant="outline" 
                  onClick={() => onEdit(trip.id)}
                  size="sm"
                  className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 text-xs sm:text-sm touch-friendly"
                >
                  تعديل
                </Button>
              )}
              {(trip.driverId === currentUserId || userRole === "admin") && onCancel && (
                <Button 
                  variant="outline" 
                  onClick={() => onCancel(trip.id)}
                  size="sm"
                  className="border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900 text-xs sm:text-sm touch-friendly"
                >
                  إلغاء
                </Button>
              )}
              
              {/* Delete button for trip owner or admin */}
              {(trip.driverId === currentUserId || userRole === "admin") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 text-xs sm:text-sm touch-friendly"
                  onClick={() => deleteTripMutation.mutate()}
                  disabled={deleteTripMutation.isPending}
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  {deleteTripMutation.isPending ? "..." : "حذف"}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
      
      {/* Trip Join Request Form */}
      <TripJoinRequestForm
        open={showJoinRequestForm}
        onClose={() => setShowJoinRequestForm(false)}
        tripId={trip.id}
        trip={trip}
      />
    </Card>
  );
}
