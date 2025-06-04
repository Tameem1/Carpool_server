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
import { useAuth } from "@/hooks/useAuth";
import { Plus, Calendar, Users, MapPin, Settings, Filter, ArrowUpDown } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [showTripForm, setShowTripForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [sortBy, setSortBy] = useState("departure_time");

  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["/api/trips", { status: statusFilter }],
    queryFn: () =>
      fetch(`/api/trips?status=${statusFilter}`).then((res) => res.json()),
  });

  const { data: myTrips = [], isLoading: myTripsLoading } = useQuery({
    queryKey: ["/api/trips/my"],
  });

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

  const sortedTrips = sortTrips(trips, sortBy);
  const sortedMyTrips = sortTrips(myTrips, sortBy);

  if (tripsLoading || myTripsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            مرحباً بعودتك، {user?.firstName}!
          </h1>
          <p className="text-gray-600 mt-2">
            {user?.role === "admin"
              ? "إدارة منصة مشاركة الرحلات"
              : "ابحث عن رحلات أو اعرض سيارتك"}
          </p>
        </div>
        <Button
          onClick={() => setShowTripForm(true)}
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          إنشاء رحلة
        </Button>
      </div>

      {user?.role === "admin" && stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                الطلبات المعلقة
              </CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingRequests}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="all-trips" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all-trips">جميع الرحلات</TabsTrigger>
          <TabsTrigger value="my-trips">رحلاتي</TabsTrigger>
        </TabsList>

        <TabsContent value="all-trips" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">الرحلات المتاحة</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
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
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="departure_time">Earliest First</SelectItem>
                    <SelectItem value="departure_time_desc">Latest First</SelectItem>
                    <SelectItem value="available_seats">Most Seats</SelectItem>
                    <SelectItem value="from_location">From A-Z</SelectItem>
                    <SelectItem value="to_location">To A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="secondary">{sortedTrips.length} رحلة</Badge>
            </div>
          </div>

          {sortedTrips.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  لا توجد رحلات متاحة
                </h3>
                <p className="text-gray-600 text-center mb-4">
                  كن أول من ينشئ رحلة وساعد الآخرين في التنقل!
                </p>
                <Button onClick={() => setShowTripForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  إنشاء أول رحلة
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      </Tabs>

      <TripForm open={showTripForm} onClose={() => setShowTripForm(false)} />
    </div>
  );
}
