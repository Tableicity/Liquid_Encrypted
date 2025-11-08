import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Filter, ArrowLeft } from "lucide-react";
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

export default function Documents({ onNavigate }: DocumentsProps) {
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

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleView = (id: string) => {
    setSelectedDoc(id);
    setShowAuthDialog(true);
  };

  const handleDownload = (id: string) => {
    // If we have an authenticated session, use it directly
    if (authenticatedSessionId) {
      downloadMutation.mutate({ id, sessionId: authenticatedSessionId });
    } else {
      // Otherwise, open auth dialog first
      setSelectedDoc(id);
      setShowAuthDialog(true);
    }
  };

  const handleAuthSuccess = (sessionId: string) => {
    // Store the authenticated session for future downloads
    setAuthenticatedSessionId(sessionId);
    
    // Immediately download the selected document
    if (selectedDoc) {
      downloadMutation.mutate({ id: selectedDoc, sessionId });
    }
    
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
              status={doc.status}
              fragmentCount={doc.fragmentCount}
              lastAccessed={doc.lastAccessed ? formatTimestamp(doc.lastAccessed) : undefined}
              size={formatFileSize(doc.size)}
              onView={() => handleView(doc.id)}
              onDownload={() => handleDownload(doc.id)}
              onDelete={() => {
                if (confirm(`Are you sure you want to delete "${doc.name}"?`)) {
                  deleteMutation.mutate(doc.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Authentication Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Authenticate to Access Document</DialogTitle>
          </DialogHeader>
          <ChatInterface 
            onAuthSuccess={handleAuthSuccess} 
            existingSessionId={authenticatedSessionId || undefined}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
