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
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Home,
  Upload as UploadIcon,
  FileText,
  BookOpen,
  LogOut,
  Loader2,
  CreditCard,
  User,
  Building2,
  Plus,
  ShieldCheck,
  ChevronRight,
  Lock,
  Fingerprint,
  KeyRound,
} from "lucide-react";
import { isAuthenticated, removeToken, getActiveOrgId, setActiveOrgId as persistActiveOrgId } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import Dashboard from "@/pages/Dashboard";
import UploadPage from "@/pages/Upload";
import Documents from "@/pages/Documents";
import Architecture from "@/pages/Architecture";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Subscribe from "@/pages/Subscribe";
import Billing from "@/pages/Billing";
import Profile from "@/pages/Profile";
import CreateOrganization from "@/pages/CreateOrganization";
import PrivacyVault from "@/pages/PrivacyVault";
import VerifyProof from "@/pages/VerifyProof";
import AuditProofs from "@/pages/AuditProofs";

type Page = "dashboard" | "upload" | "documents" | "architecture" | "billing" | "profile" | "create-org" | "privacy-vault" | "verify-proof" | "audit-proofs";
type AuthView = "login" | "signup";

interface OrgResponse {
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    type: string;
    ownerId: string;
    createdAt: string;
  }>;
}

interface SubscriptionResponse {
  subscription: {
    id: string;
    status: string;
  } | null;
}

const NOIR_ENABLED = import.meta.env.VITE_NOIR_ENABLED === "true";

function AppContent() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [needsSubscription, setNeedsSubscription] = useState(false);
  const [activeOrgId, setActiveOrgIdState] = useState<string>(getActiveOrgId() || "");
  const [zkpOpen, setZkpOpen] = useState(false);
  const { toast } = useToast();

  const setActiveOrgId = (id: string) => {
    setActiveOrgIdState(id);
    persistActiveOrgId(id);
    queryClient.invalidateQueries();
  };

  useEffect(() => {
    setAuthenticated(isAuthenticated());

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success' && isAuthenticated()) {
      window.history.replaceState({}, '', window.location.pathname);
      toast({
        title: "Payment Successful",
        description: "Your subscription is now active!",
      });
      setNeedsSubscription(false);
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
    }
  }, [toast]);

  const { data: subscriptionData, isLoading: subscriptionLoading, error: subscriptionError } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/subscriptions/current"],
    enabled: authenticated,
    retry: false,
  });

  const { data: orgsData } = useQuery<OrgResponse>({
    queryKey: ["/api/organizations"],
    enabled: authenticated,
  });

  const organizations = orgsData?.organizations || [];
  const activeOrg = organizations.find(o => o.id === activeOrgId) || organizations[0];

  useEffect(() => {
    if (organizations.length > 0 && !activeOrgId) {
      const sandbox = organizations.find(o => o.type === "sandbox");
      const orgId = sandbox?.id || organizations[0].id;
      setActiveOrgIdState(orgId);
      persistActiveOrgId(orgId);
    }
  }, [organizations, activeOrgId]);

  const subscription = subscriptionData?.subscription;

  useEffect(() => {
    if (subscriptionError && authenticated) {
      const errorMessage = (subscriptionError as any)?.message || '';
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid or expired token')) {
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
    queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
    queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
  };

  const handleSubscriptionComplete = () => {
    setNeedsSubscription(false);
    queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
  };

  const handleLogout = () => {
    removeToken();
    setAuthenticated(false);
    setNeedsSubscription(false);
    setActiveOrgIdState("");
    queryClient.clear();
  };

  const handleOrgCreated = (org: { id: string; name: string; slug: string; type: string }) => {
    setActiveOrgId(org.id);
    queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
    setCurrentPage("dashboard");
  };

  const menuItems = [
    { title: "Dashboard", page: "dashboard" as const, icon: Home },
    { title: "Upload", page: "upload" as const, icon: UploadIcon },
    { title: "Documents", page: "documents" as const, icon: FileText },
    { title: "Profile", page: "profile" as const, icon: User },
    { title: "Billing", page: "billing" as const, icon: CreditCard },
    { title: "Architecture", page: "architecture" as const, icon: BookOpen },
  ];

  const style = {
    "--sidebar-width": "17rem",
    "--sidebar-width-icon": "3rem",
  };

  if (authenticated && subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasActiveSubscription = subscription && subscription.status === "active";
  const showSubscriptionPage = authenticated && !subscriptionLoading && !hasActiveSubscription;

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

                  {organizations.length > 0 && (
                    <div className="px-3 pb-3">
                      <Select value={activeOrgId} onValueChange={setActiveOrgId}>
                        <SelectTrigger
                          className="w-full"
                          data-testid="select-org-switcher"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Building2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                            <SelectValue placeholder="Select organization" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {organizations.map((org) => (
                            <SelectItem
                              key={org.id}
                              value={org.id}
                              data-testid={`select-org-${org.slug}`}
                            >
                              <span className="truncate">{org.name}</span>
                              {org.type === "sandbox" && (
                                <span className="ml-2 text-xs text-muted-foreground">(sandbox)</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-1 justify-start text-muted-foreground"
                        onClick={() => setCurrentPage("create-org")}
                        data-testid="button-create-org-nav"
                      >
                        <Plus className="w-3.5 h-3.5 mr-2" />
                        New Organization
                      </Button>
                    </div>
                  )}

                  <div className="mx-3 my-2 h-px bg-border" />

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

                  <div className="mx-3 my-2 h-px bg-border" />

                  <SidebarGroupLabel className="px-4 text-xs text-muted-foreground uppercase tracking-wider">
                    Advanced
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <Collapsible open={zkpOpen} onOpenChange={setZkpOpen}>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          className="w-full"
                          data-testid="nav-zero-proofs"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span className="flex-1 text-left">Zero Proofs</span>
                          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${zkpOpen ? "rotate-90" : ""}`} />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenu className="pl-4">
                          <SidebarMenuItem>
                            <SidebarMenuButton
                              disabled={!NOIR_ENABLED}
                              onClick={() => NOIR_ENABLED && setCurrentPage("privacy-vault")}
                              isActive={currentPage === "privacy-vault"}
                              data-testid="nav-zkp-commitments"
                            >
                              <Lock className="w-4 h-4" />
                              <span>Commitments</span>
                              {!NOIR_ENABLED && <Lock className="w-3 h-3 ml-auto text-muted-foreground" />}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton
                              disabled={!NOIR_ENABLED}
                              onClick={() => NOIR_ENABLED && setCurrentPage("verify-proof")}
                              isActive={currentPage === "verify-proof"}
                              data-testid="nav-zkp-verify"
                            >
                              <Fingerprint className="w-4 h-4" />
                              <span>Verify</span>
                              {!NOIR_ENABLED && <Lock className="w-3 h-3 ml-auto text-muted-foreground" />}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton
                              disabled={!NOIR_ENABLED}
                              onClick={() => NOIR_ENABLED && setCurrentPage("audit-proofs")}
                              isActive={currentPage === "audit-proofs"}
                              data-testid="nav-zkp-proofs"
                            >
                              <KeyRound className="w-4 h-4" />
                              <span>Proof History</span>
                              {!NOIR_ENABLED && <Lock className="w-3 h-3 ml-auto text-muted-foreground" />}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        </SidebarMenu>
                        {!NOIR_ENABLED && (
                          <p className="px-4 py-2 text-xs text-muted-foreground">
                            Zero Knowledge Proofs will be available when Noir integration is enabled.
                          </p>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
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
              <header className="flex items-center justify-between gap-2 p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  {activeOrg && (
                    <span className="text-sm text-muted-foreground hidden sm:inline" data-testid="text-active-org">
                      {activeOrg.name}
                    </span>
                  )}
                </div>
                <ThemeToggle />
              </header>

              <main className="flex-1 overflow-auto p-8">
                {currentPage === "dashboard" && (
                  <Dashboard onNavigate={setCurrentPage} />
                )}
                {currentPage === "upload" && <UploadPage onNavigate={setCurrentPage} isSandbox={activeOrg?.type === "sandbox"} />}
                {currentPage === "documents" && (
                  <Documents onNavigate={setCurrentPage} isSandbox={activeOrg?.type === "sandbox"} />
                )}
                {currentPage === "architecture" && (
                  <Architecture onNavigate={setCurrentPage} />
                )}
                {currentPage === "billing" && <Billing />}
                {currentPage === "profile" && <Profile />}
                {currentPage === "create-org" && (
                  <CreateOrganization
                    onNavigate={(page) => setCurrentPage(page as Page)}
                    onOrgCreated={handleOrgCreated}
                  />
                )}
                {currentPage === "privacy-vault" && (
                  <PrivacyVault onNavigate={(page) => setCurrentPage(page as Page)} isSandbox={activeOrg?.type === "sandbox"} />
                )}
                {currentPage === "verify-proof" && (
                  <VerifyProof onNavigate={(page) => setCurrentPage(page as Page)} />
                )}
                {currentPage === "audit-proofs" && (
                  <AuditProofs onNavigate={(page) => setCurrentPage(page as Page)} />
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
