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
import { formatGMTPlus3 } from "@shared/timezone";

// Helper function to extract and format time from timestamp
function formatTimeOnly(timestamp: string): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
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
    
    const compatibleTrips = allTrips.filter((trip: any) => {
      // Check if trip has available seats
      if (trip.availableSeats < 1) return false;
      
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

    // Sort by time proximity (closest to requested time first)
    return compatibleTrips.sort((a: any, b: any) => {
      const requestTime = new Date(request.preferredTime).getTime();
      const aTimeDiff = Math.abs(new Date(a.departureTime).getTime() - requestTime);
      const bTimeDiff = Math.abs(new Date(b.departureTime).getTime() - requestTime);
      return aTimeDiff - bTimeDiff;
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
                    <th className="text-left py-3 px-4">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {!Array.isArray(allTrips) || allTrips.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-gray-500">
                        لم يتم العثور على رحلات. أنشئ رحلتك الأولى للبدء.
                      </td>
                    </tr>
                  ) : (
                    allTrips.map((trip: any) => (
                      <tr key={trip.id} className="border-b">
                        <td className="py-4 px-4">
                          <div>
                            <div className={`font-medium text-gray-900 ${(isArabicText(trip.fromLocation) || isArabicText(trip.toLocation)) ? 'text-right' : 'text-left'}`}>
                              {formatRoute(trip.fromLocation, trip.toLocation)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatTimeOnly(trip.departureTime)}
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
