import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TripCard } from "@/components/TripCard";
import { TripForm } from "@/components/TripForm";
import { RideRequestForm } from "@/components/RideRequestForm";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Calendar, Users, MapPin, Settings, Filter, ArrowUpDown, Clock, UserPlus } from "lucide-react";
import { format } from "date-fns";

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

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showTripForm, setShowTripForm] = useState(false);
  const [showRideRequestForm, setShowRideRequestForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [sortBy, setSortBy] = useState("departure_time");

  // Function to get today's trip range (5 AM today to 4 AM tomorrow)
  const getTodayTripRange = () => {
    const now = new Date();
    const today = new Date(now);
    
    // If current time is before 5 AM, consider it part of previous day
    if (now.getHours() < 5) {
      today.setDate(today.getDate() - 1);
    }
    
    // Start at 5 AM today
    const startTime = new Date(today);
    startTime.setHours(5, 0, 0, 0);
    
    // End at 4 AM tomorrow
    const endTime = new Date(today);
    endTime.setDate(endTime.getDate() + 1);
    endTime.setHours(4, 0, 0, 0);
    
    return { startTime, endTime };
  };

  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["/api/trips", { status: statusFilter }],
    queryFn: () =>
      fetch(`/api/trips?status=${statusFilter}`).then((res) => res.json()),
  });

  // Filter trips to show only today's trips (5 AM to 4 AM next day)
  const todayTrips = trips.filter((trip: any) => {
    const { startTime, endTime } = getTodayTripRange();
    const tripTime = new Date(trip.departureTime);
    return tripTime >= startTime && tripTime <= endTime;
  });

  const { data: myTrips = [], isLoading: myTripsLoading } = useQuery({
    queryKey: ["/api/trips/my"],
    enabled: user?.role !== "admin", // Don't fetch my trips for admin users
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    enabled: user?.role === "admin",
  });

  const { data: allRequests = [] } = useQuery({
    queryKey: ["/api/ride-requests/all"],
    enabled: !!user && user.role === 'admin',
    retry: false,
  });

  // Sorting function
  const sortTrips = (trips: any[], sortBy: string) => {
    if (!Array.isArray(trips)) return [];
    
    const sortedTrips = [...trips];
    switch (sortBy) {
      case "departure_time":
        return sortedTrips.sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());
      case "departure_time_desc":
        return sortedTrips.sort((a, b) => new Date(b.departureTime).getTime() - new Date(a.departureTime).getTime());
      case "available_seats":
        return sortedTrips.sort((a, b) => b.availableSeats - a.availableSeats);
      case "from_location":
        return sortedTrips.sort((a, b) => a.fromLocation.localeCompare(b.fromLocation));
      case "to_location":
        return sortedTrips.sort((a, b) => a.toLocation.localeCompare(b.toLocation));
      default:
        return sortedTrips;
    }
  };

  const assignRideMutation = useMutation({
    mutationFn: async ({ requestId, tripId }: { requestId: number; tripId: number }) => {
      await apiRequest("PATCH", `/api/ride-requests/${requestId}/assign-to-trip`, { tripId });
    },
    onSuccess: () => {
      toast({
        title: "تم تعيين الرحلة",
        description: "تم تعيين طلب الرحلة للرحلة بنجاح.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ride-requests/all"] });
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في تعيين الرحلة",
        variant: "destructive",
      });
    },
  });

  const getCompatibleTrips = (request: any) => {
    if (!Array.isArray(trips)) return [];
    
    return trips.filter((trip: any) => {
      // Check if trip has available seats
      if (trip.availableSeats < 1) return false;
      
      // Check if trip is active
      if (trip.status !== 'active') return false;
      
      // Check location compatibility (basic string matching)
      const fromMatch = trip.fromLocation.toLowerCase().includes(request.fromLocation.toLowerCase()) ||
                       request.fromLocation.toLowerCase().includes(trip.fromLocation.toLowerCase());
      const toMatch = trip.toLocation.toLowerCase().includes(request.toLocation.toLowerCase()) ||
                     request.toLocation.toLowerCase().includes(trip.toLocation.toLowerCase());
      
      if (!fromMatch && !toMatch) return false;
      
      // Check time compatibility (within 2 hours)
      const tripTime = new Date(trip.departureTime).getTime();
      const requestTime = new Date(request.preferredTime).getTime();
      const timeDiff = Math.abs(tripTime - requestTime);
      const twoHours = 2 * 60 * 60 * 1000;
      
      return timeDiff <= twoHours;
    });
  };

  const handleAssignRide = (requestId: number, tripId: number) => {
    assignRideMutation.mutate({ requestId, tripId });
  };

  const sortedTrips = sortTrips(todayTrips, sortBy);
  const sortedMyTrips = sortTrips(myTrips, sortBy);

  if (tripsLoading || myTripsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 mobile-safe-area">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 gap-4">
        <div className="flex-1">
          <h1 className="responsive-text-2xl font-bold text-gray-900 dark:text-white">
            مرحباً بعودتك، {user?.firstName}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 sm:mt-2 text-sm sm:text-base">
            {user?.role === "admin"
              ? "إدارة منصة مشاركة الرحلات"
              : "ابحث عن رحلات أو اعرض سيارتك"}
          </p>
        </div>
        <Button
          onClick={() => setShowTripForm(true)}
          className="bg-primary hover:bg-primary/90 touch-friendly w-full sm:w-auto"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          إنشاء رحلة
        </Button>
      </div>

      {user?.role === "admin" && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">
                الطلبات المعلقة
              </CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="responsive-text-xl font-bold">{(stats as any).pendingRequests || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {user?.role === "admin" && (
        <Card className="mb-6 sm:mb-8">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1">
                <CardTitle className="responsive-text-lg">تعيين طلبات الرحلات</CardTitle>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">تعيين طلبات الرحلات المعلقة للرحلات المتاحة</p>
              </div>
              <Button
                onClick={() => setShowRideRequestForm(true)}
                className="hover:bg-blue-700 text-white bg-[#16b7a4] touch-friendly w-full sm:w-auto"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                طلب رحلة
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!Array.isArray(allRequests) || allRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                لا توجد طلبات رحلات معلقة للتعيين.
              </div>
            ) : (
              <div className="space-y-4">
                {allRequests.filter((request: any) => request.status === 'pending').map((request: any) => {
                  const compatibleTrips = getCompatibleTrips(request);
                  return (
                    <div key={request.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={request.rider?.profileImageUrl || ""} />
                            <AvatarFallback>
                              {request.rider?.firstName?.[0]}{request.rider?.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {request.rider?.firstName} {request.rider?.lastName}
                            </h4>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <div className={`flex items-center ${(isArabicText(request.fromLocation) || isArabicText(request.toLocation)) ? 'text-right' : 'text-left'}`}>
                                <MapPin className="h-4 w-4 mr-1" />
                                {formatRoute(request.fromLocation, request.toLocation)}
                              </div>
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 mr-1" />
                                {format(new Date(request.preferredTime), "MMM d, h:mm a")}
                              </div>
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {request.passengerCount} {request.passengerCount !== 1 ? 'ركاب' : 'راكب'}
                        </Badge>
                      </div>
                      
                      {request.notes && (
                        <div className="mb-4 p-3 bg-white rounded-md border">
                          <p className="text-sm font-medium text-gray-700 mb-1">ملاحظات:</p>
                          <p className="text-sm text-gray-600">{request.notes}</p>
                        </div>
                      )}

                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-700">الرحلات المتوافقة:</span>
                        {compatibleTrips.length === 0 ? (
                          <span className="text-sm text-gray-500">لا توجد رحلات متوافقة متاحة</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {compatibleTrips.map((trip: any) => (
                              <div key={trip.id} className="flex items-center space-x-2 bg-white border rounded-lg p-3">
                                <div className="flex-1">
                                  <div className="font-medium text-sm">
                                    {trip.fromLocation} → {trip.toLocation}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {format(new Date(trip.departureTime), "MMM d, h:mm a")} • 
                                    {trip.availableSeats} {trip.availableSeats !== 1 ? 'مقاعد' : 'مقعد'} متاح
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleAssignRide(request.id, trip.id)}
                                  disabled={assignRideMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  <UserPlus className="h-4 w-4 mr-1" />
                                  {assignRideMutation.isPending ? "..." : "تعيين"}
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="all-trips" className="w-full">
        <TabsList className={`grid w-full ${user?.role === "admin" ? "grid-cols-1" : "grid-cols-2"} h-auto`}>
          <TabsTrigger value="all-trips" className="touch-friendly text-sm">جميع الرحلات</TabsTrigger>
          {user?.role !== "admin" && <TabsTrigger value="my-trips" className="touch-friendly text-sm">رحلاتي</TabsTrigger>}
        </TabsList>

        <TabsContent value="all-trips" className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div className="flex-1">
              <h2 className="responsive-text-xl font-semibold">رحلات اليوم</h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">من الساعة 5 صباحاً حتى 4 صباحاً من اليوم التالي</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-32 touch-friendly">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشطة</SelectItem>
                    <SelectItem value="inactive">غير نشطة</SelectItem>
                    <SelectItem value="all">الكل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-gray-500" />
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-40 touch-friendly">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="secondary" className="text-xs">{sortedTrips.length} رحلة</Badge>
            </div>
          </div>

          {sortedTrips.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
                <Calendar className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mb-3 sm:mb-4" />
                <h3 className="responsive-text-lg font-medium text-gray-900 dark:text-white mb-2">
                  لا توجد رحلات لليوم
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-center mb-4 text-sm sm:text-base px-4">
                  كن أول من ينشئ رحلة اليوم وساعد الآخرين في التنقل!
                </p>
                <Button onClick={() => setShowTripForm(true)} className="touch-friendly">
                  <Plus className="h-4 w-4 mr-2" />
                  إنشاء رحلة لليوم
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {sortedTrips.map((trip: any) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  userRole={user?.role}
                  currentUserId={user?.id}
                  showActions={trip.driverId !== user?.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {user?.role !== "admin" && (
          <TabsContent value="my-trips" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">رحلاتي</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-gray-500" />
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="departure_time">الأبكر أولاً</SelectItem>
                      <SelectItem value="departure_time_desc">الأحدث أولاً</SelectItem>
                      <SelectItem value="available_seats">أكثر المقاعد</SelectItem>
                      <SelectItem value="from_location">من أ-ي</SelectItem>
                      <SelectItem value="to_location">إلى أ-ي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Badge variant="secondary">{Array.isArray(myTrips) ? myTrips.length : 0} رحلة</Badge>
              </div>
            </div>

            {!Array.isArray(myTrips) || myTrips.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MapPin className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    لا توجد رحلات بعد
                  </h3>
                  <p className="text-gray-600 text-center mb-4">
                    ابدأ بإنشاء رحلتك الأولى لمشاركة الرحلات مع الآخرين.
                  </p>
                  <Button onClick={() => setShowTripForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    إنشاء رحلة
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedMyTrips.map((trip: any) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    userRole={user?.role}
                    currentUserId={user?.id}
                    showActions={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      <TripForm open={showTripForm} onClose={() => setShowTripForm(false)} />
      <RideRequestForm open={showRideRequestForm} onClose={() => setShowRideRequestForm(false)} />
    </div>
  );
}
