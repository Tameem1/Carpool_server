import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Clock, Users, Star, Car, UserPlus, UserMinus, Trash2 } from "lucide-react";
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

export function TripCard({ trip, onRequestSeat, onEdit, onCancel, showActions = true, userRole, currentUserId }: TripCardProps) {
  const departureDate = new Date(trip.departureTime);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Debug logging
  console.log('TripCard Debug:', {
    currentUserId,
    tripDriverId: trip.driver?.id,
    tripRiders: trip.riders,
    availableSeats: trip.availableSeats,
    tripStatus: trip.status,
    showActions,
    userRole
  });

  // Fetch all users for the dropdown (admin only)
  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    enabled: userRole === 'admin'
  });

  // Add rider mutation
  const addRiderMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/trips/${trip.id}/riders`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add rider');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      toast({
        title: "Success",
        description: "Rider added to trip successfully"
      });
      setSelectedUserId("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add rider to trip",
        variant: "destructive"
      });
    }
  });

  // Remove rider mutation
  const removeRiderMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/trips/${trip.id}/riders/${userId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to remove rider');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      toast({
        title: "Success",
        description: "Rider removed from trip successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove rider from trip",
        variant: "destructive"
      });
    }
  });

  // Join trip mutation
  const joinTripMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/trips/${trip.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to join trip');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trips/my'] });
      toast({
        title: "Success",
        description: "Successfully joined the trip!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join trip",
        variant: "destructive"
      });
    }
  });

  // Delete trip mutation
  const deleteTripMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/trips/${trip.id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete trip');
      }
      return response.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      toast({
        title: "Success",
        description: "Trip deleted successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete trip",
        variant: "destructive"
      });
    }
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
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {trip.fromLocation} → {trip.toLocation}
            </h3>
            <p className="text-sm text-gray-600 flex items-center mt-1">
              <Clock className="h-4 w-4 mr-1" />
              {format(departureDate, "MMMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
          <Badge className={getStatusColor(trip.status)}>
            {trip.status}
          </Badge>
        </div>

        {trip.driver && (
          <div className="flex items-center mb-4">
            <Avatar className="h-10 w-10 mr-3">
              <AvatarImage src={trip.driver.profileImageUrl || ""} alt="Driver" />
              <AvatarFallback>
                {trip.driver.firstName[0]}{trip.driver.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-gray-900">
                {trip.driver.firstName} {trip.driver.lastName}
              </p>
              <p className="text-sm text-gray-600">Driver</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-600">Pickup</p>
            <p className="font-medium truncate">{trip.fromLocation}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Destination</p>
            <p className="font-medium truncate">{trip.toLocation}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Riders</p>
            <p className="font-medium flex items-center">
              <Users className="h-4 w-4 mr-1" />
              {trip.riders?.length || 0} / {trip.totalSeats}
            </p>
          </div>
        </div>

        {trip.riderDetails && trip.riderDetails.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Current Riders:</p>
            <div className="flex flex-wrap gap-2">
              {trip.riderDetails.map((rider) => (
                <div key={rider.id} className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {rider.firstName} {rider.lastName}
                  </Badge>
                  {userRole === 'admin' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-4 w-4 p-0 hover:bg-red-100"
                      onClick={() => removeRiderMutation.mutate(rider.id)}
                      disabled={removeRiderMutation.isPending}
                    >
                      <UserMinus className="h-3 w-3 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {userRole === 'admin' && users && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Add Rider:</p>
            <div className="flex items-center gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {(users as any[])
                    ?.filter((user: any) => 
                      user.id !== trip.driver?.id && 
                      !trip.riders?.includes(user.id)
                    )
                    .map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.role})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => selectedUserId && addRiderMutation.mutate(selectedUserId)}
                disabled={!selectedUserId || addRiderMutation.isPending || (trip.riders?.length || 0) >= trip.totalSeats}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-gray-600">
              <Users className="h-4 w-4 mr-2" />
              <span>
                {trip.totalSeats - (trip.riders?.length || 0)} seats available
              </span>
            </div>
          </div>

          {showActions && (
            <div className="flex space-x-2">
              {/* Join Trip button - for users who are not the driver and not already riders */}
              {currentUserId && 
               currentUserId !== trip.driver?.id && 
               !trip.riders?.includes(currentUserId) && 
               trip.availableSeats > 0 && 
               trip.status === 'active' && (
                <Button 
                  onClick={() => joinTripMutation.mutate()}
                  disabled={joinTripMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {joinTripMutation.isPending ? "Joining..." : "Join Trip"}
                </Button>
              )}
              
              {/* Request Seat button - alternative to join trip */}
              {userRole === 'rider' && onRequestSeat && trip.availableSeats > 0 && 
               currentUserId !== trip.driver?.id && 
               !trip.riders?.includes(currentUserId) && (
                <Button 
                  onClick={() => onRequestSeat(trip.id)}
                  className="bg-primary hover:bg-primary/90"
                >
                  Request Seat
                </Button>
              )}
              
              {/* Already joined indicator */}
              {currentUserId && trip.riders?.includes(currentUserId) && (
                <Button 
                  disabled
                  variant="outline"
                  className="border-green-500 text-green-600"
                >
                  Already Joined
                </Button>
              )}
              
              {(userRole === 'driver' || userRole === 'admin') && onEdit && (
                <Button 
                  variant="outline" 
                  onClick={() => onEdit(trip.id)}
                >
                  Edit
                </Button>
              )}
              {(userRole === 'driver' || userRole === 'admin') && onCancel && (
                <Button 
                  variant="destructive" 
                  onClick={() => onCancel(trip.id)}
                >
                  Cancel
                </Button>
              )}
              {userRole === 'admin' && (
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => deleteTripMutation.mutate()}
                  disabled={deleteTripMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
