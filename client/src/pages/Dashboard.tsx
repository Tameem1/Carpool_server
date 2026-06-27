import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { PreferredTimeDialog } from "@/components/PreferredTimeDialog";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus,
  Calendar,
  Users,
  MapPin,
  Settings,
  ArrowUpDown,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { formatGMTPlus3, formatGMTPlus3TimeOnly } from "@shared/timezone";

// Helper function to extract and format time from timestamp in GMT+3
function formatTimeOnly(timestamp: string): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return formatGMTPlus3TimeOnly(date, "en-US");
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

export default function Dashboard() {
  const { user } = useAuth();
  const [showTripForm, setShowTripForm] = useState(false);
  const [showPreferredTime, setShowPreferredTime] = useState(false);

  const [sortBy, setSortBy] = useState("departure_time");
  const [activeTab, setActiveTab] = useState("all-trips");

  // Trips data is kept fresh via refetchOnWindowFocus plus a short staleTime,
  // so switching tabs reuses the cache instead of forcing a blocking refetch.

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
    queryKey: ["/api/trips"],
    queryFn: () => fetch(`/api/trips`).then((res) => res.json()),
    refetchOnWindowFocus: true,
    staleTime: 30_000, // Reuse cached data for 30s to avoid blocking refetches
  });

  // Filter trips to show only today's trips (5 AM to 4 AM next day)
  const todayTrips = Array.isArray(trips)
    ? trips.filter((trip: any) => {
        const { startTime, endTime } = getTodayTripRange();
        const tripTime = new Date(trip.departureTime);
        return tripTime >= startTime && tripTime <= endTime;
      })
    : [];

  // Apply the same today filtering logic on the frontend to ensure consistency
  const { data: allMyTrips = [], isLoading: myTripsLoading } = useQuery({
    queryKey: ["/api/trips/my"],
    enabled: user?.role !== "admin", // Don't fetch my trips for admin users
    refetchOnWindowFocus: true,
    staleTime: 30_000, // Reuse cached data for 30s to avoid blocking refetches
  });

  // Filter my trips to show only today's trips using the same logic as "All Trips"
  const myTrips = Array.isArray(allMyTrips)
    ? allMyTrips.filter((trip: any) => {
        const { startTime, endTime } = getTodayTripRange();
        const tripTime = new Date(trip.departureTime);
        return tripTime >= startTime && tripTime <= endTime;
      })
    : [];

  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    enabled: user?.role === "admin",
  });

  // Sorting function
  const sortTrips = (trips: any[], sortBy: string) => {
    if (!Array.isArray(trips)) return [];

    const sortedTrips = [...trips];
    switch (sortBy) {
      case "departure_time":
        return sortedTrips.sort(
          (a, b) =>
            new Date(a.departureTime).getTime() -
            new Date(b.departureTime).getTime(),
        );
      case "departure_time_desc":
        return sortedTrips.sort(
          (a, b) =>
            new Date(b.departureTime).getTime() -
            new Date(a.departureTime).getTime(),
        );
      case "available_seats":
        return sortedTrips.sort((a, b) => b.availableSeats - a.availableSeats);
      case "from_location":
        return sortedTrips.sort((a, b) =>
          a.fromLocation.localeCompare(b.fromLocation),
        );
      case "to_location":
        return sortedTrips.sort((a, b) =>
          a.toLocation.localeCompare(b.toLocation),
        );
      default:
        return sortedTrips;
    }
  };

  const sortedTrips = sortTrips(
    Array.isArray(todayTrips) ? todayTrips : [],
    sortBy,
  );

  let displayedTrips = sortedTrips;
  if (activeTab === "outgoing-trips") {
    displayedTrips = sortedTrips.filter((trip: any) => !trip.isReturnTrip);
  } else if (activeTab === "return-trips") {
    displayedTrips = sortedTrips.filter((trip: any) => trip.isReturnTrip);
  }

  const tabSectionTitle =
    activeTab === "outgoing-trips"
      ? "رحلات الذهاب"
      : activeTab === "return-trips"
        ? "رحلات العودة"
        : "رحلات اليوم";

  const sortedMyTrips = sortTrips(
    Array.isArray(myTrips) ? myTrips : [],
    sortBy,
  );

  if (tripsLoading || myTripsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mobile-container py-3 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 gap-4">
        <div className="flex-1">
          <h1 className="responsive-text-2xl font-bold text-gray-900 dark:text-white">
            مرحباً بعودتك، {user?.username}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 sm:mt-2 text-sm sm:text-base">
            {user?.role === "admin"
              ? "إدارة منصة مشاركة الرحلات"
              : "ابحث عن رحلات أو اعرض سيارتك"}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button
            onClick={() => setShowPreferredTime(true)}
            variant="outline"
            className="touch-friendly w-full sm:w-auto"
            size="sm"
          >
            <Clock className="h-4 w-4 mr-2" />
            وقت المغادرة المفضل
          </Button>
          <Button
            onClick={() => setShowTripForm(true)}
            className="bg-primary hover:bg-primary/90 touch-friendly w-full sm:w-auto"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            إنشاء رحلة
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          className={`grid w-full ${
            user?.role === "admin" ? "grid-cols-3" : "grid-cols-4"
          } h-auto`}
        >
          <TabsTrigger value="all-trips" className="touch-friendly text-sm">
            الجميع
          </TabsTrigger>

          <TabsTrigger
            value="outgoing-trips"
            className="touch-friendly text-sm"
          >
            الذهاب
          </TabsTrigger>

          <TabsTrigger value="return-trips" className="touch-friendly text-sm">
            العودة
          </TabsTrigger>

          {user?.role !== "admin" && (
            <TabsTrigger value="my-trips" className="touch-friendly text-sm">
              رحلاتي
            </TabsTrigger>
          )}
        </TabsList>
        {/* Shared layout for الجميع / الذهاب / العودة — one section, no JSX duplication */}
        {activeTab !== "my-trips" && (
          <div className="space-y-4 mt-2">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
              <div className="flex-1">
                <h2 className="responsive-text-xl font-semibold">{tabSectionTitle}</h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  من الساعة 5 صباحاً حتى 4 صباحاً من اليوم التالي
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-gray-500" />
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full sm:w-40 touch-friendly">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="departure_time">الأبكر أولاً</SelectItem>
                      <SelectItem value="departure_time_desc">
                        الأحدث أولاً
                      </SelectItem>
                      <SelectItem value="available_seats">
                        أكثر المقاعد
                      </SelectItem>
                      <SelectItem value="from_location">من أ-ي</SelectItem>
                      <SelectItem value="to_location">إلى أ-ي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {displayedTrips.length} رحلة
                </Badge>
              </div>
            </div>

            {displayedTrips.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
                  <Calendar className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mb-3 sm:mb-4" />
                  <h3 className="responsive-text-lg font-medium text-gray-900 dark:text-white mb-2">
                    لا توجد رحلات
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-center mb-4 text-sm sm:text-base px-4">
                    كن أول من ينشئ رحلة اليوم وساعد الآخرين في التنقل!
                  </p>
                  <Button
                    onClick={() => setShowTripForm(true)}
                    className="touch-friendly"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    إنشاء رحلة لليوم
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {displayedTrips.map((trip: any) => (
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
          </div>
        )}

        {user?.role !== "admin" && (
          <TabsContent value="my-trips" className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
              <div className="flex-1">
                <h2 className="responsive-text-xl font-semibold">
                  رحلاتي لليوم
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  من الساعة 5 صباحاً حتى 4 صباحاً من اليوم التالي
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-gray-500" />
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full sm:w-40 touch-friendly">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="departure_time">
                        الأبكر أولاً
                      </SelectItem>
                      <SelectItem value="departure_time_desc">
                        الأحدث أولاً
                      </SelectItem>
                      <SelectItem value="available_seats">
                        أكثر المقاعد
                      </SelectItem>
                      <SelectItem value="from_location">من أ-ي</SelectItem>
                      <SelectItem value="to_location">إلى أ-ي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {sortedMyTrips.length} رحلة
                </Badge>
              </div>
            </div>

            {sortedMyTrips.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
                  <MapPin className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mb-3 sm:mb-4" />
                  <h3 className="responsive-text-lg font-medium text-gray-900 dark:text-white mb-2">
                    لا توجد رحلات لك اليوم
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-center mb-4 text-sm sm:text-base px-4">
                    ابدأ بإنشاء رحلتك الأولى لليوم وساعد الآخرين في التنقل!
                  </p>
                  <Button
                    onClick={() => setShowTripForm(true)}
                    className="touch-friendly"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    إنشاء رحلة لليوم
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {sortedMyTrips.map((trip: any) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    userRole={user?.role}
                    currentUserId={user?.id}
                    showActions={true}
                    hideJoinRequest={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      <TripForm open={showTripForm} onClose={() => setShowTripForm(false)} />
      <PreferredTimeDialog
        open={showPreferredTime}
        onClose={() => setShowPreferredTime(false)}
      />
    </div>
  );
}
