import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RealTimeContextType {
  isConnected: boolean;
  connectionStatus: "connecting" | "connected" | "disconnected";
}

const RealTimeContext = createContext<RealTimeContextType>({
  isConnected: false,
  connectionStatus: "disconnected",
});

export function useRealTime() {
  return useContext(RealTimeContext);
}

interface RealTimeProviderProps {
  children: React.ReactNode;
}

export function RealTimeProvider({ children }: RealTimeProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const connect = async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus("connecting");

    try {
      // Fetch WebSocket port from server configuration
      const configResponse = await fetch('/api/config');
      const config = await configResponse.json();
      const websocketPort = config.websocketPort || 5001;

      // Use secure WebSocket in production, regular WebSocket in development
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.hostname}:${websocketPort}`;
      console.log("Connecting to WebSocket:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Real-time WebSocket connected");
        setIsConnected(true);
        setConnectionStatus("connected");

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleRealTimeMessage(message);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        console.log("Real-time WebSocket disconnected");
        setIsConnected(false);
        setConnectionStatus("disconnected");

        // Attempt to reconnect after 3 seconds
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnected(false);
        setConnectionStatus("disconnected");
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setConnectionStatus("disconnected");
    }
  };

  const handleRealTimeMessage = (message: any) => {
    console.log("Real-time message received:", message);
    switch (message.type) {
      case "notification":
        // Invalidate notifications cache to fetch new notifications
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });

        // Show toast notification
        if (message.data) {
          toast({
            title: message.data.title,
            description: message.data.message,
          });
        }
        break;

      case "trip_created":
        // Invalidate trips cache to show new trip
        queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trips/my"] });
        queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
        break;

      case "trip_updated":
        // Invalidate trips cache to show updated trip
        queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trips/my"] });
        queryClient.invalidateQueries({ queryKey: ["/api/stats"] });

        if (message.data?.id) {
          queryClient.invalidateQueries({
            queryKey: ["/api/trips", message.data.id],
          });
        }

        // Force immediate refetch for better real-time experience
        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: ["/api/trips"] });
          queryClient.refetchQueries({ queryKey: ["/api/trips/my"] });
        }, 100);
        break;

      case "ride_request_created":
        // Invalidate ride requests cache
        queryClient.invalidateQueries({ queryKey: ["/api/ride-requests"] });
        queryClient.invalidateQueries({ queryKey: ["/api/ride-requests/all"] });
        break;

      case "ride_request_updated":
        // Invalidate ride requests cache
        queryClient.invalidateQueries({ queryKey: ["/api/ride-requests"] });
        queryClient.invalidateQueries({ queryKey: ["/api/ride-requests/all"] });

        if (message.data?.id) {
          queryClient.invalidateQueries({
            queryKey: ["/api/ride-requests", message.data.id],
          });
        }
        break;

      case "trip_deleted":
        // Invalidate trips cache when a trip is deleted
        queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trips/my"] });
        queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
        break;

      case "user_updated":
        // Invalidate users cache
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        break;

      default:
        console.log("Unknown real-time message type:", message.type);
    }
  };

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const contextValue: RealTimeContextType = {
    isConnected,
    connectionStatus,
  };

  return (
    <RealTimeContext.Provider value={contextValue}>
      {children}
    </RealTimeContext.Provider>
  );
}
