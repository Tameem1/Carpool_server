import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { User, Phone, Mail, Save, MessageCircle } from "lucide-react";
import AddUserDialog from "@/components/AddUserDialog";

export function UserProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    phoneNumber: "",
    telegramUsername: "",
  });

  const [showAddUser, setShowAddUser] = useState(false);

  // Update form data when user data loads
  useEffect(() => {
    if (user) {
      setFormData({
        phoneNumber: user.phoneNumber || "",
        telegramUsername: user.telegramUsername || "",
      });
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("PATCH", "/api/users/profile", data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!user) {
    return <div>Please log in to view your profile.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto mobile-padding py-3 sm:py-6 lg:py-8">
      {/* Admin Add User Button */}
      {user.role === 'admin' && (
        <div className="flex justify-end mb-4">
          <Button onClick={() => setShowAddUser(true)} className="bg-primary hover:bg-primary/90">
            إضافة مستخدم
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.profileImageUrl || ""} />
              <AvatarFallback className="text-lg">
                {user.username?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-semibold">
                {user.username}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <Mail className="h-4 w-4" />
                {user.email}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                Role: {user.role}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={user?.username || ""}
                  readOnly
                  disabled
                  className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Username cannot be changed
                </p>
              </div>
              <div>
                <Label htmlFor="section">Section</Label>
                <Input
                  id="section"
                  value={user?.section || ""}
                  readOnly
                  disabled
                  className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Section cannot be changed
                </p>
              </div>
            </div>
            
            <div>
              <Label htmlFor="phoneNumber" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                placeholder="Enter your phone number (e.g., +1-555-0123)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Your phone number will be visible to drivers when you join their trips
              </p>
            </div>

            <div>
              <Label htmlFor="telegramUsername" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Telegram ID
              </Label>
              <Input
                id="telegramUsername"
                value={formData.telegramUsername}
                onChange={(e) => handleInputChange("telegramUsername", e.target.value)}
                placeholder="Enter your Telegram ID (e.g., 123456789)"
              />
              <p className="text-xs text-gray-500 mt-1">
                {user?.role === 'admin' 
                  ? "Your Telegram ID is required to receive notifications about new ride requests. To find your Telegram ID, message @userinfobot on Telegram."
                  : "Optional: Your Telegram ID for notifications."
                }
              </p>
            </div>

            <Button 
              type="submit" 
              disabled={updateProfileMutation.isPending}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      {user.role === 'admin' && (
        <AddUserDialog open={showAddUser} onClose={() => setShowAddUser(false)} />
      )}
    </div>
  );
}