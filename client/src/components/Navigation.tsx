import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bell, Car, MessageSquare, Home, Users, Settings, UserCheck, User } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { RealTimeStatus } from "@/components/RealTimeStatus";

export function Navigation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [location] = useLocation();

  const { data: notifications = [] } = useQuery({
    queryKey: ["/api/notifications"],
    enabled: !!user,
  });

  const unreadCount = Array.isArray(notifications)
    ? notifications.filter((n: any) => !n.isRead).length
    : 0;

  const handleLogout = async () => {
    try {
      // Clear all React Query cache
      queryClient.clear();

      // Call logout endpoint
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      // Redirect to home page (which will show login form for unauthenticated users)
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      // Force redirect even if there's an error
      window.location.href = "/";
    }
  };

  const navItems = [
    {
      href: "/",
      label: "لوحة التحكم",
      icon: Home,
      active: location === "/",
    },
    {
      href: "/profile",
      label: "الملف الشخصي",
      icon: User,
      active: location === "/profile",
    },

  ];

  // Admin users see the same dashboard with additional admin features

  return (
    <nav className="bg-white dark:bg-gray-900 shadow-sm border-b mobile-safe-area">
      <div className="mobile-container">
        <div className="flex justify-between items-center h-14 sm:h-16">
          <div className="flex items-center space-x-4 sm:space-x-8">
            <div className="flex-shrink-0 flex items-center">
              <Car className="h-6 w-6 sm:h-8 sm:w-8 text-primary mr-2 sm:mr-3" />
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white hidden xs:block">
                وصلني عالنادي
              </h1>
              <h1 className="text-base font-bold text-gray-900 dark:text-white xs:hidden px-2">
                وصلني عالنادي
              </h1>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={item.active ? "default" : "ghost"}
                      size="sm"
                      className={`flex items-center space-x-2 touch-friendly ${
                        item.active
                          ? "bg-primary text-primary-foreground"
                          : "text-gray-600 hover:text-primary dark:text-gray-300 dark:hover:text-primary"
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

          <div className="flex items-center space-x-3">
            <RealTimeStatus />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="touch-friendly text-sm sm:text-base text-gray-600 hover:text-primary dark:text-gray-300 dark:hover:text-primary"
            >
              <span className="hidden sm:inline">تسجيل الخروج</span>
              <span className="sm:hidden">خروج</span>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation - Bottom Bar Style */}
        <div className="lg:hidden border-t pt-2 pb-3">
          <div className="flex justify-around space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="flex-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`w-full flex flex-col items-center justify-center py-2 px-1 touch-friendly ${
                      item.active
                        ? "text-primary bg-primary/10"
                        : "text-gray-600 hover:text-primary dark:text-gray-400 dark:hover:text-primary"
                    }`}
                  >
                    <Icon className="h-5 w-5 mb-1" />
                    <span className="text-xs leading-tight">{item.label}</span>
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
