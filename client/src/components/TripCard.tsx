import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Users, Star, Car } from "lucide-react";
import { format } from "date-fns";

interface TripCardProps {
  trip: {
    id: number;
    fromLocation: string;
    toLocation: string;
    departureTime: string;
    availableSeats: number;
    totalSeats: number;
    riders?: string[];

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
}

export function TripCard({ trip, onRequestSeat, onEdit, onCancel, showActions = true, userRole }: TripCardProps) {
  const departureDate = new Date(trip.departureTime);


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

        {trip.riders && trip.riders.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Current Riders:</p>
            <div className="flex flex-wrap gap-2">
              {trip.riders.map((riderId, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {riderId}
                </Badge>
              ))}
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
              {userRole === 'rider' && onRequestSeat && trip.availableSeats > 0 && (
                <Button 
                  onClick={() => onRequestSeat(trip.id)}
                  className="bg-primary hover:bg-primary/90"
                >
                  Request Seat
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
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
