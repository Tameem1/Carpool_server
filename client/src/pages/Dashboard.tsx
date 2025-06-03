import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TripCard } from "@/components/TripCard";
import { TripForm } from "@/components/TripForm";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Calendar, Users, MapPin, Settings, Filter } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [showTripForm, setShowTripForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");

  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["/api/trips", { status: statusFilter }],
    queryFn: () => fetch(`/api/trips?status=${statusFilter}`).then(res => res.json()),
  });

  const { data: myTrips = [], isLoading: myTripsLoading } = useQuery({
    queryKey: ["/api/trips/my"],
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    enabled: user?.role === "admin",
  });

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
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-gray-600 mt-2">
            {user?.role === "admin" ? "Manage the carpool platform" : "Find rides or offer your car"}
          </p>
        </div>
        <Button onClick={() => setShowTripForm(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Create Trip
        </Button>
      </div>

      {user?.role === "admin" && stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Trips</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeTrips}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Trips</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedTrips}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
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
          <TabsTrigger value="all-trips">All Trips</TabsTrigger>
          <TabsTrigger value="my-trips">My Trips</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all-trips" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Available Trips</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="secondary">{trips.length} trips</Badge>
            </div>
          </div>
          
          {trips.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No trips available</h3>
                <p className="text-gray-600 text-center mb-4">
                  Be the first to create a trip and help others get around!
                </p>
                <Button onClick={() => setShowTripForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Trip
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trips.map((trip: any) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  userRole={user?.role}
                  showActions={trip.driverId !== user?.id}
                />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="my-trips" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">My Trips</h2>
            <Badge variant="secondary">{myTrips.length} trips</Badge>
          </div>
          
          {myTrips.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MapPin className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No trips yet</h3>
                <p className="text-gray-600 text-center mb-4">
                  Start by creating your first trip to share rides with others.
                </p>
                <Button onClick={() => setShowTripForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Trip
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myTrips.map((trip: any) => (
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

      <TripForm
        open={showTripForm}
        onClose={() => setShowTripForm(false)}
      />
    </div>
  );
}