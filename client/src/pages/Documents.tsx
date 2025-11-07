import { useState } from "react";
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

interface DocumentsProps {
  onNavigate: (page: "dashboard") => void;
}

export default function Documents({ onNavigate }: DocumentsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  //todo: remove mock functionality
  const [documents] = useState([
    {
      id: "1",
      name: "Financial_Report_Q4_2024.pdf",
      status: "liquid" as const,
      fragmentCount: 8,
      lastAccessed: "2 hours ago",
      size: "2.4 MB",
    },
    {
      id: "2",
      name: "Product_Specifications.docx",
      status: "reconstituted" as const,
      fragmentCount: 12,
      lastAccessed: "1 day ago",
      size: "1.8 MB",
    },
    {
      id: "3",
      name: "Strategic_Plan_2025.pdf",
      status: "accessible" as const,
      fragmentCount: 6,
      lastAccessed: "Just now",
      size: "3.2 MB",
    },
    {
      id: "4",
      name: "Research_Analysis.pdf",
      status: "liquid" as const,
      fragmentCount: 10,
      lastAccessed: "3 days ago",
      size: "4.1 MB",
    },
    {
      id: "5",
      name: "Legal_Contract_Draft.docx",
      status: "liquid" as const,
      fragmentCount: 7,
      lastAccessed: "1 week ago",
      size: "1.2 MB",
    },
  ]);

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleView = (id: string) => {
    setSelectedDoc(id);
    setShowAuthDialog(true);
  };

  const handleAuthSuccess = () => {
    console.log("Authentication successful for document:", selectedDoc);
    setShowAuthDialog(false);
    // In real app, would show document viewer
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.map((doc) => (
          <DocumentCard
            key={doc.id}
            {...doc}
            onView={() => handleView(doc.id)}
            onDownload={() => console.log("Download", doc.id)}
            onDelete={() => console.log("Delete", doc.id)}
          />
        ))}
      </div>

      {filteredDocs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No documents found</p>
        </div>
      )}

      {/* Authentication Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Authenticate to Access Document</DialogTitle>
          </DialogHeader>
          <ChatInterface onAuthSuccess={handleAuthSuccess} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
