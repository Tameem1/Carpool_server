import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const queryClient = useQueryClient();

  const { data: user, error, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user", {
        credentials: "include",
      });
      if (response.ok) {
        const userData = await response.json();
        setIsAuthenticated(true);
        return userData;
      }
      if (response.status === 401) {
        setIsAuthenticated(false);
        return null;
      }
      throw new Error("Failed to fetch user");
    },
    retry: false,
  });

  useEffect(() => {
    if (user) {
      setIsAuthenticated(true);
    } else if (error) {
      setIsAuthenticated(false);
    }
  }, [user, error]);

  const login = () => {
    window.location.href = "/api/auth/login";
  };

  const logout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setIsAuthenticated(false);
    queryClient.clear();
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
}
