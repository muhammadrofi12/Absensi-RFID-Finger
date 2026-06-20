import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth, AuthState } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";

import Dashboard from "@/pages/dashboard";
import Employees from "@/pages/employees";
import Attendance from "@/pages/attendance";
import Leave from "@/pages/leave";
import Shifts from "@/pages/shifts";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

function Router() {
  const { user } = useAuth();

  // If not logged in, only allow /login
  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }

  // Logged in routes
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      
      {/* Admin Only Routes */}
      <Route path="/employees">
        {user.role === "admin" ? <Employees /> : <Redirect to="/" />}
      </Route>
      <Route path="/attendance">
        {user.role === "admin" ? <Attendance /> : <Redirect to="/" />}
      </Route>

      {/* Shared Routes */}
      <Route path="/leave" component={Leave} />
      <Route path="/shifts" component={Shifts} />

      <Route path="/login">
        <Redirect to="/" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function MainLayout() {
  const { user } = useAuth();
  
  // Activate WebSocket listener for real-time notifications when logged in
  useWebSocket();

  if (!user) {
    return <Router />;
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto bg-background">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppWithAuth() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white gap-3">
        <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
        <span className="text-sm text-slate-400 font-medium animate-pulse">Memuat aplikasi...</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <MainLayout />
      <Toaster />
    </TooltipProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppWithAuth />
    </QueryClientProvider>
  );
}

export default App;
