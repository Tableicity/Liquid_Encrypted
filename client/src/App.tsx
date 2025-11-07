import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
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
import { Home, Upload as UploadIcon, FileText, BookOpen } from "lucide-react";
import Dashboard from "@/pages/Dashboard";
import UploadPage from "@/pages/Upload";
import Documents from "@/pages/Documents";
import Architecture from "@/pages/Architecture";

type Page = "dashboard" | "upload" | "documents" | "architecture";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");

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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
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
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
