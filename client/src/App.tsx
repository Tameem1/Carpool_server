import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { Navigation } from "@/components/Navigation";
import { RealTimeProvider } from "@/contexts/RealTimeContext";
import { LoginForm } from "@/components/LoginForm";
import Dashboard from "@/pages/Dashboard";

import AdminDashboard from "@/pages/AdminDashboard";
import DriverDashboard from "@/pages/DriverDashboard";
import RiderDashboard from "@/pages/RiderDashboard";

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
        <Route path="/">
          {() => (
            <div className="min-h-screen flex items-center justify-center bg-background">
              <LoginForm onLogin={() => window.location.reload()} />
            </div>
          )}
        </Route>
      ) : (
        <>
          <Route path="/" component={() => (
            <div className="min-h-screen bg-background">
              <Navigation />
              <Dashboard />
            </div>
          )} />

          <Route path="/admin" component={() => (
            <div className="min-h-screen bg-background">
              <Navigation />
              <AdminDashboard />
            </div>
          )} />
          
          <Route path="/driver" component={() => (
            <div className="min-h-screen bg-background">
              <Navigation />
              <DriverDashboard />
            </div>
          )} />
          
          <Route path="/rider" component={() => (
            <div className="min-h-screen bg-background">
              <Navigation />
              <RiderDashboard />
            </div>
          )} />

          <Route path="/profile" component={() => (
            <div className="min-h-screen bg-background">
              <Navigation />
              <UserProfile />
            </div>
          )} />
          
          <Route component={NotFound} />
        </>
      )}
      {!isAuthenticated && <Route component={NotFound} />}
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
