import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RideRequestForm } from "@/components/RideRequestForm";
import { TripCard } from "@/components/TripCard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Plus, Search } from "lucide-react";

export default function RiderDashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [searchParams, setSearchParams] = useState({
    from: "",
    to: "",
    date: "",
  });

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: myRequests = [] } = useQuery({
    queryKey: ["/api/ride-requests/my"],
    enabled: !!user && user.role === 'rider',
    retry: false,
  });

  const { data: availableTrips = [] } = useQuery({
    queryKey: ["/api/trips", searchParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchParams.from) params.append('from', searchParams.from);
      if (searchParams.to) params.append('to', searchParams.to);
      if (searchParams.date) params.append('date', searchParams.date);
      
      const response = await fetch(`/api/trips?${params.toString()}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: !!user && user.role === 'rider',
    retry: false,
  });

  const requestSeatMutation = useMutation({
    mutationFn: async (tripId: number) => {
      // For simplicity, we'll create a ride request that matches the trip
      const trip = availableTrips.find((t: any) => t.id === tripId);
      if (!trip) throw new Error("Trip not found");
      
      await apiRequest("POST", "/api/ride-requests", {
        fromLocation: trip.fromLocation,
        toLocation: trip.toLocation,
        preferredTime: trip.departureTime,
        passengerCount: 1,
        notes: `Requesting seat for trip ${tripId}`,
      });
    },
    onSuccess: () => {
      toast({
        title: "Seat Requested",
        description: "Your seat request has been submitted. The driver will be notified!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ride-requests/my"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to request seat",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
  };

  const handleRequestSeat = (tripId: number) => {
    requestSeatMutation.mutate(tripId);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user || user.role !== 'rider') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
              <p className="text-gray-600">You need rider privileges to access this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Find a Ride</h2>
          <Button onClick={() => setShowRequestForm(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Request Ride
          </Button>
        </div>

        {/* Quick Search Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Search Available Rides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="from">From</Label>
                <Input
                  id="from"
                  placeholder="Pickup location"
                  value={searchParams.from}
                  onChange={(e) => setSearchParams({ ...searchParams, from: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="to">To</Label>
                <Input
                  id="to"
                  placeholder="Destination"
                  value={searchParams.to}
                  onChange={(e) => setSearchParams({ ...searchParams, to: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={searchParams.date}
                  onChange={(e) => setSearchParams({ ...searchParams, date: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleSearch} className="w-full bg-primary hover:bg-primary/90">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Your Ride Requests */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Your Ride Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {myRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No ride requests yet. Request a ride to get started!
              </div>
            ) : (
              <div className="space-y-4">
                {myRequests.map((request: any) => (
                  <div key={request.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">
                          {request.fromLocation} → {request.toLocation}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {new Date(request.preferredTime).toLocaleDateString()} at{' '}
                          {new Date(request.preferredTime).toLocaleTimeString()}
                        </p>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        request.status === 'pending' ? 'bg-warning/20 text-warning' :
                        request.status === 'accepted' ? 'bg-success/20 text-success' :
                        'bg-destructive/20 text-destructive'
                      }`}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Pickup</p>
                        <p className="font-medium">{request.fromLocation}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Destination</p>
                        <p className="font-medium">{request.toLocation}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">
                      {request.passengerCount} passenger{request.passengerCount > 1 ? 's' : ''} • 
                      Status: {request.status === 'pending' ? 'Waiting for driver confirmation' : 
                                request.status === 'accepted' ? 'Confirmed! Check your notifications for details.' :
                                'Request was declined'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Rides */}
        <Card>
          <CardHeader>
            <CardTitle>Available Rides</CardTitle>
            <p className="text-sm text-gray-600">Rides matching your search criteria</p>
          </CardHeader>
          <CardContent>
            {availableTrips.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No rides found. Try adjusting your search criteria or check back later.
              </div>
            ) : (
              <div className="space-y-4">
                {availableTrips.map((trip: any) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    onRequestSeat={handleRequestSeat}
                    userRole="rider"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RideRequestForm 
        open={showRequestForm} 
        onClose={() => setShowRequestForm(false)}
      />
    </div>
  );
}
