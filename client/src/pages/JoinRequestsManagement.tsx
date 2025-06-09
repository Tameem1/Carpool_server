import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Clock, 
  MapPin, 
  Users, 
  Check, 
  X, 
  MessageSquare,
  Calendar,
  User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

interface JoinRequest {
  id: number;
  tripId: number;
  riderId: string;
  seatsRequested: number;
  message?: string;
  status: "pending" | "approved" | "declined";
  createdAt: string;
  trip?: {
    id: number;
    fromLocation: string;
    toLocation: string;
    departureTime: string;
    availableSeats: number;
    totalSeats: number;
    driver?: {
      id: string;
      firstName: string;
      lastName: string;
      profileImageUrl?: string;
    };
  };
  rider?: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
  };
}

export default function JoinRequestsManagement() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "declined">("pending");

  const { data: joinRequests = [], isLoading, refetch } = useQuery<JoinRequest[]>({
    queryKey: ["/api/trip-join-requests"],
    enabled: user?.role === "admin",
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: number; status: "approved" | "declined" }) => {
      const response = await fetch(`/api/trip-join-requests/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update request");
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trip-join-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({
        title: variables.status === "approved" ? "تم القبول" : "تم الرفض",
        description: variables.status === "approved" 
          ? "تم قبول طلب الانضمام بنجاح"
          : "تم رفض طلب الانضمام",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في تحديث طلب الانضمام",
        variant: "destructive",
      });
    },
  });

  if (authLoading) {
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

  const filteredRequests = joinRequests.filter((request) => {
    if (filter === "all") return true;
    return request.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "declined":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "في الانتظار";
      case "approved":
        return "مقبول";
      case "declined":
        return "مرفوض";
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading join requests...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">إدارة طلبات الانضمام</h2>
          <Button onClick={() => refetch()} variant="outline">
            تحديث
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-2 mb-6">
          {[
            { key: "pending", label: "في الانتظار", count: joinRequests.filter((r) => r.status === "pending").length },
            { key: "approved", label: "مقبولة", count: joinRequests.filter((r) => r.status === "approved").length },
            { key: "declined", label: "مرفوضة", count: joinRequests.filter((r) => r.status === "declined").length },
            { key: "all", label: "الكل", count: joinRequests.length },
          ].map((tab) => (
            <Button
              key={tab.key}
              variant={filter === tab.key ? "default" : "outline"}
              onClick={() => setFilter(tab.key as any)}
              className="relative"
            >
              {tab.label}
              <Badge variant="secondary" className="ml-2">
                {tab.count}
              </Badge>
            </Button>
          ))}
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">في الانتظار</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {joinRequests.filter((r) => r.status === "pending").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Check className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">مقبولة</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {joinRequests.filter((r) => r.status === "approved").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <X className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">مرفوضة</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {joinRequests.filter((r) => r.status === "declined").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">إجمالي الطلبات</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {joinRequests.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Join Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                لا توجد طلبات انضمام
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {filter === "pending" ? "لا توجد طلبات في الانتظار حالياً" : `لا توجد طلبات ${getStatusText(filter)}`}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  <div className="flex-1 space-y-4">
                    {/* Request Info */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={request.rider?.profileImageUrl || ""}
                            alt={request.rider?.firstName || "Rider"}
                          />
                          <AvatarFallback>
                            {request.rider?.firstName?.[0]}{request.rider?.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {request.rider?.firstName} {request.rider?.lastName}
                          </h4>
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <Calendar className="h-4 w-4 mr-1" />
                            {formatDate(request.createdAt)}
                          </div>
                        </div>
                      </div>
                      <Badge className={getStatusColor(request.status)}>
                        {getStatusText(request.status)}
                      </Badge>
                    </div>

                    {/* Trip Details */}
                    {request.trip && (
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <h5 className="font-medium text-gray-900 dark:text-white mb-2">تفاصيل الرحلة:</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-gray-600 dark:text-gray-400">من:</span>
                            <span className="font-medium text-gray-900 dark:text-white ml-1">
                              {request.trip.fromLocation}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-gray-600 dark:text-gray-400">إلى:</span>
                            <span className="font-medium text-gray-900 dark:text-white ml-1">
                              {request.trip.toLocation}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-gray-600 dark:text-gray-400">التوقيت:</span>
                            <span className="font-medium text-gray-900 dark:text-white ml-1">
                              {formatDate(request.trip.departureTime)}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Users className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-gray-600 dark:text-gray-400">المقاعد المطلوبة:</span>
                            <span className="font-medium text-gray-900 dark:text-white ml-1">
                              {request.seatsRequested}
                            </span>
                          </div>
                          {request.trip.driver && (
                            <div className="flex items-center">
                              <User className="h-4 w-4 text-gray-400 mr-2" />
                              <span className="text-gray-600 dark:text-gray-400">السائق:</span>
                              <span className="font-medium text-gray-900 dark:text-white ml-1">
                                {request.trip.driver.firstName} {request.trip.driver.lastName}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Message */}
                    {request.message && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <div className="flex items-start">
                          <MessageSquare className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
                              رسالة من الطالب:
                            </p>
                            <p className="text-sm text-blue-800 dark:text-blue-400">
                              {request.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {request.status === "pending" && (
                    <div className="flex space-x-2 lg:ml-4">
                      <Button
                        onClick={() => updateRequestMutation.mutate({ 
                          requestId: request.id, 
                          status: "approved" 
                        })}
                        disabled={updateRequestMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        قبول
                      </Button>
                      <Button
                        onClick={() => updateRequestMutation.mutate({ 
                          requestId: request.id, 
                          status: "declined" 
                        })}
                        disabled={updateRequestMutation.isPending}
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900"
                        size="sm"
                      >
                        <X className="h-4 w-4 mr-1" />
                        رفض
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}