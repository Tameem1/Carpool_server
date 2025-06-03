import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Users, MessageSquare, Plus } from "lucide-react";
import { format } from "date-fns";
import { RideRequestForm } from "@/components/RideRequestForm";

export default function Requests() {
  const { user } = useAuth();
  const [showRequestForm, setShowRequestForm] = useState(false);

  const { data: allRequests = [], isLoading } = useQuery({
    queryKey: ["/api/ride-requests/all"],
    enabled: !!user,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
              <p className="text-gray-600">You need to be logged in to view ride requests.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">All Ride Requests</h2>
            <p className="text-gray-600">Browse all pending ride requests from users</p>
          </div>
          <Button 
            onClick={() => setShowRequestForm(true)} 
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Request Ride
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Ride Requests</CardTitle>
          <p className="text-sm text-gray-600">
            {allRequests.length} request{allRequests.length !== 1 ? 's' : ''} waiting for rides
          </p>
        </CardHeader>
        <CardContent>
          {allRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No Ride Requests</h3>
              <p>There are currently no pending ride requests.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allRequests.map((request: any) => (
                <div key={request.id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={request.rider?.profileImageUrl || ""} />
                        <AvatarFallback>
                          {request.rider?.firstName?.[0]}{request.rider?.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {request.rider?.firstName} {request.rider?.lastName}
                        </h4>
                        <Badge 
                          variant="secondary" 
                          className="bg-warning/20 text-warning hover:bg-warning/30"
                        >
                          {request.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        Requested {format(new Date(request.createdAt), "MMM d, yyyy")}
                      </p>
                      <p className="text-sm text-gray-500">
                        at {format(new Date(request.createdAt), "h:mm a")}
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-2 text-green-600" />
                        <span className="font-medium">From:</span>
                        <span className="ml-1">{request.fromLocation}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-2 text-red-600" />
                        <span className="font-medium">To:</span>
                        <span className="ml-1">{request.toLocation}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="h-4 w-4 mr-2 text-blue-600" />
                        <span className="font-medium">Preferred Time:</span>
                        <span className="ml-1">
                          {format(new Date(request.preferredTime), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="h-4 w-4 mr-2 text-purple-600" />
                        <span className="font-medium">Passengers:</span>
                        <span className="ml-1">{request.passengerCount || 1}</span>
                      </div>
                    </div>
                  </div>

                  {request.notes && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-md">
                      <p className="text-sm font-medium text-gray-700 mb-1">Additional Requirements:</p>
                      <p className="text-sm text-gray-600">{request.notes}</p>
                    </div>
                  )}

                  {user.role === 'driver' && (
                    <div className="flex justify-end space-x-2 pt-4 border-t">
                      <Button variant="outline" size="sm">
                        Contact Rider
                      </Button>
                      <Button size="sm" className="bg-success hover:bg-success/90">
                        Offer Ride
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RideRequestForm 
        open={showRequestForm} 
        onClose={() => setShowRequestForm(false)}
      />
    </div>
  );
}