import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { Navigation } from "@/components/Navigation";
import { RealTimeProvider } from "@/contexts/RealTimeContext";
import { LoginForm } from "@/components/LoginForm";
import Dashboard from "@/pages/Dashboard";
import SchedulePage from "@/pages/SchedulePage";

import AdminDashboard from "@/pages/AdminDashboard";
import DriverDashboard from "@/pages/DriverDashboard";
import RiderDashboard from "@/pages/RiderDashboard";

import { UserProfile } from "@/components/UserProfile";
import NotFound from "@/pages/not-found";

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="px-3 sm:px-0">{children}</div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoginForm onLogin={() => navigate("/")} />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={() => (
        <PageShell><Dashboard /></PageShell>
      )} />

      <Route path="/schedule" component={() => (
        <PageShell><SchedulePage /></PageShell>
      )} />

      <Route path="/admin" component={() => (
        <PageShell><AdminDashboard /></PageShell>
      )} />

      <Route path="/driver" component={() => (
        <PageShell><DriverDashboard /></PageShell>
      )} />

      <Route path="/rider" component={() => (
        <PageShell><RiderDashboard /></PageShell>
      )} />

      <Route path="/profile" component={() => (
        <PageShell><UserProfile /></PageShell>
      )} />

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
