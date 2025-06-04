import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TripForm } from "@/components/TripForm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Plus, Edit, Trash2, UserPlus, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";

export default function AdminDashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showTripForm, setShowTripForm] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "غير مخول",
        description: "تم تسجيل خروجك. جاري تسجيل الدخول مرة أخرى...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);



  const { data: allTrips = [] } = useQuery({
    queryKey: ["/api/trips"],
    enabled: !!user && user.role === 'admin',
    retry: false,
  });

  const { data: allRequests = [] } = useQuery({
    queryKey: ["/api/ride-requests/all"],
    enabled: !!user && user.role === 'admin',
    retry: false,
  });

  const deleteTripMutation = useMutation({
    mutationFn: async (tripId: number) => {
      await apiRequest("DELETE", `/api/trips/${tripId}`);
    },
    onSuccess: () => {
      toast({
        title: "تم حذف الرحلة",
        description: "تم حذف الرحلة بنجاح.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
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
        title: "خطأ",
        description: error.message || "فشل في حذف الرحلة",
        variant: "destructive",
      });
    },
  });

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
        description: error.message || "Failed to assign ride",
        variant: "destructive",
      });
    },
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

  const handleEditTrip = (trip: any) => {
    setEditingTrip(trip);
    setShowTripForm(true);
  };

  const handleDeleteTrip = (tripId: number) => {
    if (confirm("هل أنت متأكد من أنك تريد حذف هذه الرحلة؟")) {
      deleteTripMutation.mutate(tripId);
    }
  };

  const handleCloseTripForm = () => {
    setShowTripForm(false);
    setEditingTrip(null);
  };

  const handleAssignRide = (requestId: number, tripId: number) => {
    assignRideMutation.mutate({ requestId, tripId });
  };

  const getCompatibleTrips = (request: any) => {
    if (!Array.isArray(allTrips)) return [];
    
    return allTrips.filter((trip: any) => {
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

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">تم رفض الوصول</h1>
              <p className="text-gray-600">تحتاج إلى صلاحيات المدير للوصول إلى هذه الصفحة.</p>
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
          <h2 className="text-2xl font-bold text-gray-900">لوحة تحكم المدير</h2>
          <Button onClick={() => setShowTripForm(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            إنشاء رحلة
          </Button>
        </div>

        {/* Ride Assignment Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>تعيين طلبات الرحلات</CardTitle>
            <p className="text-sm text-gray-600">تعيين طلبات الرحلات المعلقة للرحلات المتاحة</p>
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
                              <div className="flex items-center">
                                <MapPin className="h-4 w-4 mr-1" />
                                {request.fromLocation} → {request.toLocation}
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

        {/* Trip Management Table */}
        <Card>
          <CardHeader>
            <CardTitle>إدارة الرحلات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">تفاصيل الرحلة</th>
                    <th className="text-left py-3 px-4">السائق</th>
                    <th className="text-left py-3 px-4">المقاعد</th>
                    <th className="text-left py-3 px-4">الحالة</th>
                    <th className="text-left py-3 px-4">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {!Array.isArray(allTrips) || allTrips.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-500">
                        لم يتم العثور على رحلات. أنشئ رحلتك الأولى للبدء.
                      </td>
                    </tr>
                  ) : (
                    allTrips.map((trip: any) => (
                      <tr key={trip.id} className="border-b">
                        <td className="py-4 px-4">
                          <div>
                            <div className="font-medium text-gray-900">
                              {trip.fromLocation} → {trip.toLocation}
                            </div>
                            <div className="text-sm text-gray-500">
                              {format(new Date(trip.departureTime), "MMM d, yyyy • h:mm a")}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {trip.driver ? (
                            <div className="flex items-center">
                              <Avatar className="h-8 w-8 mr-3">
                                <AvatarImage src={trip.driver.profileImageUrl || ""} />
                                <AvatarFallback>
                                  {trip.driver.firstName?.[0]}{trip.driver.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">
                                {trip.driver.firstName} {trip.driver.lastName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">لا يوجد سائق معين</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-gray-900">
                            {trip.participantCount || 0}/{trip.totalSeats} مقعد
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <Badge className={getStatusColor(trip.status)}>
                            {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditTrip(trip)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteTrip(trip.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <TripForm 
        open={showTripForm} 
        onClose={handleCloseTripForm}
        trip={editingTrip}
      />
    </div>
  );
}
