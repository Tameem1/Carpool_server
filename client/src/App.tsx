import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { Navigation } from "@/components/Navigation";
import { RealTimeProvider } from "@/contexts/RealTimeContext";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";

import AdminDashboard from "@/pages/AdminDashboard";
import DriverDashboard from "@/pages/DriverDashboard";
import RiderDashboard from "@/pages/RiderDashboard";
import JoinRequestsManagement from "@/pages/JoinRequestsManagement";
import { UserProfile } from "@/components/UserProfile";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/">
            {() => (
              <div className="min-h-screen bg-background">
                <Navigation />
                <Dashboard />
              </div>
            )}
          </Route>

          <Route path="/admin">
            {() => (
              <div className="min-h-screen bg-background">
                <Navigation />
                <AdminDashboard />
              </div>
            )}
          </Route>
          <Route path="/driver">
            {() => (
              <div className="min-h-screen bg-background">
                <Navigation />
                <DriverDashboard />
              </div>
            )}
          </Route>
          <Route path="/rider">
            {() => (
              <div className="min-h-screen bg-background">
                <Navigation />
                <RiderDashboard />
              </div>
            )}
          </Route>
          <Route path="/admin/join-requests">
            {() => (
              <div className="min-h-screen bg-background">
                <Navigation />
                <JoinRequestsManagement />
              </div>
            )}
          </Route>

          <Route path="/profile">
            {() => (
              <div className="min-h-screen bg-background">
                <Navigation />
                <UserProfile />
              </div>
            )}
          </Route>
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RealTimeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </RealTimeProvider>
    </QueryClientProvider>
  );
}

export default App;
