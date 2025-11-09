import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Home, Upload as UploadIcon, FileText, BookOpen, LogOut, Loader2 } from "lucide-react";
import { isAuthenticated, removeToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import Dashboard from "@/pages/Dashboard";
import UploadPage from "@/pages/Upload";
import Documents from "@/pages/Documents";
import Architecture from "@/pages/Architecture";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Subscribe from "@/pages/Subscribe";

type Page = "dashboard" | "upload" | "documents" | "architecture";
type AuthView = "login" | "signup";

interface Subscription {
  id: string;
  status: string;
}

function AppContent() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [needsSubscription, setNeedsSubscription] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setAuthenticated(isAuthenticated());
    
    // Check for payment success redirect from Stripe
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success' && isAuthenticated()) {
      // Clear the query parameter
      window.history.replaceState({}, '', window.location.pathname);
      
      // Show success toast
      toast({
        title: "Payment Successful",
        description: "Your subscription is now active!",
      });
      
      // Mark subscription as complete
      setNeedsSubscription(false);
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
    }
  }, [toast]);

  const { data: subscription, isLoading: subscriptionLoading, error: subscriptionError } = useQuery<Subscription | null>({
    queryKey: ["/api/subscriptions/current"],
    enabled: authenticated,
    retry: false,
  });

  // Handle invalid/expired token
  useEffect(() => {
    if (subscriptionError && authenticated) {
      // Check if it's a 401 error
      const errorMessage = (subscriptionError as any)?.message || '';
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid or expired token')) {
        // Token is invalid, clear it and show login
        removeToken();
        setAuthenticated(false);
        setNeedsSubscription(false);
        queryClient.clear();
        toast({
          title: "Session Expired",
          description: "Please log in again to continue.",
          variant: "destructive",
        });
      }
    }
  }, [subscriptionError, authenticated, toast]);

  const handleLogin = () => {
    setAuthenticated(true);
    setNeedsSubscription(true);
  };

  const handleSubscriptionComplete = () => {
    setNeedsSubscription(false);
    queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
  };

  const handleLogout = () => {
    removeToken();
    setAuthenticated(false);
    setNeedsSubscription(false);
    queryClient.clear();
  };

  const menuItems = [
    { title: "Dashboard", page: "dashboard" as const, icon: Home },
    { title: "Upload", page: "upload" as const, icon: UploadIcon },
    { title: "Documents", page: "documents" as const, icon: FileText },
    { title: "Architecture", page: "architecture" as const, icon: BookOpen },
  ];

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  // Show loading state while checking subscription
  if (authenticated && subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Determine if user needs to subscribe
  const hasActiveSubscription = subscription && subscription.status === "active";
  const showSubscriptionPage = authenticated && needsSubscription && !hasActiveSubscription;

  return (
    <>
      {!authenticated ? (
        authView === "login" ? (
          <Login
            onSuccess={handleLogin}
            onSwitchToSignup={() => setAuthView("signup")}
          />
        ) : (
          <Signup
            onSuccess={handleLogin}
            onSwitchToLogin={() => setAuthView("login")}
          />
        )
      ) : showSubscriptionPage ? (
        <Subscribe onSuccess={handleSubscriptionComplete} />
      ) : (
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <Sidebar>
              <SidebarContent>
                <SidebarGroup>
                  <div className="px-4 py-6">
                    <h2 className="text-lg font-bold">Liquid Encrypt</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Quantum-Resistant Security
                    </p>
                  </div>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {menuItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            onClick={() => setCurrentPage(item.page)}
                            isActive={currentPage === item.page}
                            data-testid={`nav-${item.page}`}
                          >
                            <item.icon className="w-4 h-4" />
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                  <div className="mt-auto p-4">
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={handleLogout}
                      data-testid="button-logout"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </Button>
                  </div>
                </SidebarGroup>
              </SidebarContent>
            </Sidebar>

            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="flex items-center justify-between p-4 border-b border-border">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <ThemeToggle />
              </header>

              <main className="flex-1 overflow-auto p-8">
                {currentPage === "dashboard" && (
                  <Dashboard onNavigate={setCurrentPage} />
                )}
                {currentPage === "upload" && <UploadPage onNavigate={setCurrentPage} />}
                {currentPage === "documents" && (
                  <Documents onNavigate={setCurrentPage} />
                )}
                {currentPage === "architecture" && (
                  <Architecture onNavigate={setCurrentPage} />
                )}
              </main>
            </div>
          </div>
        </SidebarProvider>
      )}
      <Toaster />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
