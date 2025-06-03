import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bell, Car, MessageSquare, Home, Users, Settings } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";

export function Navigation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  
  const { data: notifications = [] } = useQuery({
    queryKey: ["/api/notifications"],
    enabled: !!user,
  });

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const handleLogout = async () => {
    try {
      // Clear all React Query cache
      queryClient.clear();
      
      // Call logout endpoint
      await fetch("/api/logout", {
        method: "GET",
        credentials: "include"
      });
      
      // Force redirect to login page
      window.location.href = "/api/login";
    } catch (error) {
      console.error("Logout error:", error);
      // Force redirect even if there's an error
      window.location.href = "/api/login";
    }
  };

  const navItems = [
    { 
      href: "/", 
      label: "Dashboard", 
      icon: Home,
      active: location === "/" 
    },
    { 
      href: "/requests", 
      label: "Requests", 
      icon: MessageSquare,
      active: location === "/requests" 
    }
  ];

  // Add role-specific nav items
  if (user?.role === 'admin') {
    navItems.push({ 
      href: "/admin", 
      label: "Admin", 
      icon: Settings,
      active: location === "/admin" 
    });
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="flex-shrink-0 flex items-center">
              <Car className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-bold text-gray-900">RideShare Pro</h1>
            </div>
            
            {/* Navigation Links */}
            <div className="hidden md:flex space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={item.active ? "default" : "ghost"}
                      size="sm"
                      className={`flex items-center space-x-2 ${
                        item.active 
                          ? "bg-primary text-primary-foreground" 
                          : "text-gray-600 hover:text-primary"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Notification Badge */}
            <div className="relative">
              <Bell className="h-5 w-5 text-gray-600 cursor-pointer hover:text-primary transition-colors" />
              {unreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-5 w-5 text-xs flex items-center justify-center p-0 bg-warning hover:bg-warning"
                >
                  {unreadCount}
                </Badge>
              )}
            </div>
            {/* Profile */}
            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profileImageUrl || ""} alt="Profile" />
                <AvatarFallback>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">
                {user?.firstName} {user?.lastName}
              </span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        <div className="md:hidden pb-3">
          <div className="flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={item.active ? "default" : "ghost"}
                    size="sm"
                    className={`flex items-center space-x-1 ${
                      item.active 
                        ? "bg-primary text-primary-foreground" 
                        : "text-gray-600 hover:text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
