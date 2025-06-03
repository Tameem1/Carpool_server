import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TripForm } from "@/components/TripForm";
import { TripCard } from "@/components/TripCard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Route, Users, Star, Plus, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function DriverDashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showTripForm, setShowTripForm] = useState(false);

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

  const { data: myTrips = [] } = useQuery({
    queryKey: ["/api/trips/my"],
    enabled: !!user && user.role === 'driver',
    retry: false,
  });

  const { data: rideRequests = [] } = useQuery({
    queryKey: ["/api/ride-requests"],
    enabled: !!user && user.role === 'driver',
    retry: false,
  });

  const acceptRequestMutation = useMutation({
    mutationFn: async ({ requestId, tripId }: { requestId: number; tripId: number }) => {
      await apiRequest("PATCH", `/api/ride-requests/${requestId}/accept`, { tripId });
    },
    onSuccess: () => {
      toast({
        title: "Request Accepted",
        description: "The ride request has been accepted. Rider will be notified!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ride-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips/my"] });
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
        description: error.message || "Failed to accept request",
        variant: "destructive",
      });
    },
  });

  const declineRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      await apiRequest("PATCH", `/api/ride-requests/${requestId}/decline`);
    },
    onSuccess: () => {
      toast({
        title: "Request Declined",
        description: "The ride request has been declined. Rider will be notified.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ride-requests"] });
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
        description: error.message || "Failed to decline request",
        variant: "destructive",
      });
    },
  });

  const activeTrips = myTrips.filter((trip: any) => trip.status === 'active');
  const completedTrips = myTrips.filter((trip: any) => trip.status === 'completed');
  const totalRidersHelped = myTrips.reduce((sum: number, trip: any) => sum + (trip.participantCount || 0), 0);

  const handleAcceptRequest = (requestId: number) => {
    // For simplicity, we'll use the first active trip
    // In a real app, you'd want to let the driver choose which trip
    const firstActiveTrip = activeTrips[0];
    if (firstActiveTrip) {
      acceptRequestMutation.mutate({ requestId, tripId: firstActiveTrip.id });
    } else {
      toast({
        title: "No Active Trips",
        description: "You need to have an active trip to accept ride requests.",
        variant: "destructive",
      });
    }
  };

  const handleDeclineRequest = (requestId: number) => {
    declineRequestMutation.mutate(requestId);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user || user.role !== 'driver') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
              <p className="text-gray-600">You need driver privileges to access this page.</p>
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
          <h2 className="text-2xl font-bold text-gray-900">Driver Dashboard</h2>
          <Button onClick={() => setShowTripForm(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Create Trip
          </Button>
        </div>

        {/* Driver Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Your Trips</p>
                  <p className="text-2xl font-bold text-gray-900">{myTrips.length}</p>
                </div>
                <Route className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Riders Helped</p>
                  <p className="text-2xl font-bold text-gray-900">{totalRidersHelped}</p>
                </div>
                <Users className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Rating</p>
                  <p className="text-2xl font-bold text-gray-900">4.8</p>
                </div>
                <Star className="h-8 w-8 text-warning fill-current" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Current Trips */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Your Active Trips</CardTitle>
          </CardHeader>
          <CardContent>
            {activeTrips.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No active trips. Create a trip to start offering rides!
              </div>
            ) : (
              <div className="space-y-4">
                {activeTrips.map((trip: any) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    showActions={false}
                    userRole="driver"
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Ride Requests */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Ride Requests</CardTitle>
            <p className="text-sm text-gray-600">Requests within ±2 hours of your trips</p>
          </CardHeader>
          <CardContent>
            {rideRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No pending ride requests matching your trips.
              </div>
            ) : (
              <div className="space-y-4">
                {rideRequests.map((request: any) => (
                  <div key={request.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center">
                        <Avatar className="h-10 w-10 mr-3">
                          <AvatarImage src={request.rider?.profileImageUrl || ""} />
                          <AvatarFallback>
                            {request.rider?.firstName?.[0]}{request.rider?.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {request.rider?.firstName} {request.rider?.lastName}
                          </h4>
                          <p className="text-sm text-gray-600">
                            Requested ride for {format(new Date(request.preferredTime), "h:mm a")}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        Pending
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">From</p>
                        <p className="font-medium">{request.fromLocation}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">To</p>
                        <p className="font-medium">{request.toLocation}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600">
                        <Clock className="h-4 w-4 inline mr-1" />
                        {request.passengerCount} passenger{request.passengerCount > 1 ? 's' : ''}
                      </p>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeclineRequest(request.id)}
                          disabled={declineRequestMutation.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAcceptRequest(request.id)}
                          disabled={acceptRequestMutation.isPending || activeTrips.length === 0}
                          className="bg-success hover:bg-success/90"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TripForm 
        open={showTripForm} 
        onClose={() => setShowTripForm(false)}
      />
    </div>
  );
}
