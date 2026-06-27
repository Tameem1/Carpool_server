import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const queryClient = useQueryClient();

  const { data: user, error, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user", {
        credentials: 'include'
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

  const login = async (credentials: { section: string; username: string; password: string }) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });

    if (response.ok) {
      const data = await response.json();
      setIsAuthenticated(true);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      return data;
    } else {
      const errorData = await response.json();
      throw new Error(errorData.message || "Login failed");
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: 'include'
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
