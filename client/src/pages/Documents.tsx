import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Filter, ArrowLeft, Download, X, Lock } from "lucide-react";
import { DocumentCard } from "@/components/DocumentCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChatInterface } from "@/components/ChatInterface";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Document } from "@shared/schema";

interface DocumentsProps {
  onNavigate: (page: "dashboard") => void;
  isSandbox?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

export default function Documents({ onNavigate, isSandbox }: DocumentsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [authenticatedSessionId, setAuthenticatedSessionId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/documents/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document deleted",
        description: "The document has been permanently removed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [viewData, setViewData] = useState<{ data: string; name: string; mimeType: string } | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<"view" | "download" | "lock" | null>(null);

  const downloadMutation = useMutation({
    mutationFn: async ({ id, sessionId }: { id: string; sessionId: string }) => {
      const res = await apiRequest("POST", `/api/documents/${id}/reconstitute`, { sessionId });
      return res.json();
    },
    onSuccess: (data: { data: string; name: string }) => {
      // Convert base64 to blob and download
      const byteCharacters = atob(data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document downloaded",
        description: "The document has been reconstituted and downloaded",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const viewMutation = useMutation({
    mutationFn: async ({ id, sessionId }: { id: string; sessionId: string }) => {
      const res = await apiRequest("POST", `/api/documents/${id}/reconstitute`, { sessionId });
      return res.json();
    },
    onSuccess: (data: { data: string; name: string }) => {
      // Determine MIME type from file extension
      // Note: HTML files are NOT rendered inline for security (XSS prevention)
      const ext = data.name.split('.').pop()?.toLowerCase() || '';
      const mimeTypes: Record<string, string> = {
        pdf: 'application/pdf',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        txt: 'text/plain',
        json: 'application/json',
        // html intentionally omitted - security risk
      };
      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      
      setViewData({ data: data.data, name: data.name, mimeType });
      setShowViewDialog(true);
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: "View failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async ({ id, sessionId }: { id: string; sessionId: string }) => {
      const res = await apiRequest("POST", `/api/documents/${id}/liquidate`, { sessionId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document locked",
        description: "The document has been returned to liquid state",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lock failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const effectiveSessionId = isSandbox ? null : authenticatedSessionId;

  const handleView = (id: string) => {
    if (effectiveSessionId) {
      viewMutation.mutate({ id, sessionId: effectiveSessionId });
    } else {
      setSelectedDoc(id);
      setPendingAction("view");
      setShowAuthDialog(true);
    }
  };

  const handleDownload = (id: string) => {
    if (effectiveSessionId) {
      downloadMutation.mutate({ id, sessionId: effectiveSessionId });
    } else {
      setSelectedDoc(id);
      setPendingAction("download");
      setShowAuthDialog(true);
    }
  };

  const handleLock = (id: string) => {
    if (effectiveSessionId) {
      lockMutation.mutate({ id, sessionId: effectiveSessionId });
    } else {
      setSelectedDoc(id);
      setPendingAction("lock");
      setShowAuthDialog(true);
    }
  };

  const handleAuthSuccess = (sessionId: string) => {
    // Store the authenticated session for future actions
    setAuthenticatedSessionId(sessionId);
    
    // Execute the pending action
    if (selectedDoc) {
      if (pendingAction === "view") {
        viewMutation.mutate({ id: selectedDoc, sessionId });
      } else if (pendingAction === "download") {
        downloadMutation.mutate({ id: selectedDoc, sessionId });
      } else if (pendingAction === "lock") {
        lockMutation.mutate({ id: selectedDoc, sessionId });
      }
    }
    
    setPendingAction(null);
    setShowAuthDialog(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate("dashboard")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold mb-2">Document Library</h1>
        <p className="text-muted-foreground">
          Manage your encrypted and fragmented documents
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-documents"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="liquid">Liquid</SelectItem>
            <SelectItem value="reconstituted">Reconstituted</SelectItem>
            <SelectItem value="accessible">Accessible</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Documents Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading documents...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {documents.length === 0 ? "No documents uploaded yet" : "No documents found"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              id={doc.id}
              name={doc.name}
              status={doc.status as "liquid" | "reconstituted" | "accessible"}
              fragmentCount={doc.fragmentCount}
              lastAccessed={doc.lastAccessed ? formatTimestamp(new Date(doc.lastAccessed).toISOString()) : undefined}
              size={formatFileSize(doc.size)}
              onView={() => handleView(doc.id)}
              onDownload={() => handleDownload(doc.id)}
              onDelete={() => {
                if (confirm(`Are you sure you want to delete "${doc.name}"?`)) {
                  deleteMutation.mutate(doc.id);
                }
              }}
              onLock={() => handleLock(doc.id)}
            />
          ))}
        </div>
      )}

      {/* Authentication Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={(open) => {
        setShowAuthDialog(open);
        if (!open) {
          // Reset pending action when dialog is closed without completing auth
          setPendingAction(null);
          setSelectedDoc(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Authenticate to Access Document</DialogTitle>
          </DialogHeader>
          {isSandbox ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center" data-testid="sandbox-ai-locked">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">AI Story Authentication</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Create a live organization to unlock AI-powered story-based authentication for your documents.
                </p>
              </div>
            </div>
          ) : (
            <ChatInterface 
              onAuthSuccess={handleAuthSuccess} 
              existingSessionId={authenticatedSessionId || undefined}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Document Viewer Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader className="flex flex-row items-center justify-between gap-2">
            <DialogTitle className="truncate">{viewData?.name}</DialogTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (viewData) {
                    const byteCharacters = atob(viewData.data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                      byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray]);
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = viewData.name;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  }
                }}
                data-testid="button-download-from-viewer"
              >
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto max-h-[70vh]">
            {viewData && (
              viewData.mimeType.startsWith('image/') ? (
                <img 
                  src={`data:${viewData.mimeType};base64,${viewData.data}`} 
                  alt={viewData.name}
                  className="max-w-full h-auto"
                />
              ) : viewData.mimeType === 'application/pdf' ? (
                <iframe
                  src={`data:${viewData.mimeType};base64,${viewData.data}`}
                  className="w-full h-[70vh]"
                  title={viewData.name}
                />
              ) : viewData.mimeType.startsWith('text/') || viewData.mimeType === 'application/json' ? (
                <pre className="p-4 bg-muted rounded-md overflow-auto text-sm font-mono whitespace-pre-wrap">
                  {atob(viewData.data)}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <p className="mb-4">Preview not available for this file type</p>
                  <Button
                    onClick={() => {
                      const byteCharacters = atob(viewData.data);
                      const byteNumbers = new Array(byteCharacters.length);
                      for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                      }
                      const byteArray = new Uint8Array(byteNumbers);
                      const blob = new Blob([byteArray]);
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = viewData.name;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    }}
                    data-testid="button-download-unsupported"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download File
                  </Button>
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
