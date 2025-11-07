import { useState } from "react";
import { FileText, Lock, Activity, Database, Upload as UploadIcon, BookOpen } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { DocumentCard } from "@/components/DocumentCard";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import heroImage from "@assets/generated_images/Data_fragmentation_hero_visualization_b7238f9c.png";

interface DashboardProps {
  onNavigate: (page: "upload" | "documents" | "architecture") => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  //todo: remove mock functionality
  const [recentDocs] = useState([
    {
      id: "1",
      name: "Financial_Report_Q4.pdf",
      status: "liquid" as const,
      fragmentCount: 8,
      lastAccessed: "2 hours ago",
      size: "2.4 MB",
    },
    {
      id: "2",
      name: "Strategy_Document.docx",
      status: "reconstituted" as const,
      fragmentCount: 12,
      lastAccessed: "1 day ago",
      size: "1.8 MB",
    },
  ]);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div
        className="relative rounded-md overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url(${heroImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="p-12 md:p-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4" style={{ letterSpacing: '-0.02em' }}>
            Liquid Encrypted Data System
          </h1>
          <p className="text-lg text-white/90 max-w-2xl mb-8">
            Revolutionary quantum-resistant security through data fragmentation,
            distributed storage, and story-based authentication.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button
              size="lg"
              onClick={() => onNavigate("upload")}
              data-testid="button-upload-new"
              className="bg-primary/90 hover:bg-primary backdrop-blur-sm"
            >
              <UploadIcon className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => onNavigate("architecture")}
              data-testid="button-view-architecture"
              className="bg-background/10 hover:bg-background/20 backdrop-blur-sm text-white border-white/30 hover:text-white"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              View Architecture
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Documents"
          value="24"
          icon={FileText}
          trend={{ value: "+12% this month", positive: true }}
        />
        <MetricCard
          title="Active Sessions"
          value="0"
          icon={Activity}
          iconColor="text-chart-2"
        />
        <MetricCard
          title="Fragments Stored"
          value="192"
          icon={Database}
          iconColor="text-chart-3"
        />
        <MetricCard
          title="Security Status"
          value="Secure"
          icon={Lock}
          iconColor="text-chart-4"
        />
      </div>

      {/* Recent Documents */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent Documents</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate("documents")}
              data-testid="button-view-all"
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                {...doc}
                onView={() => console.log("View", doc.id)}
                onDownload={() => console.log("Download", doc.id)}
                onDelete={() => console.log("Delete", doc.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-2">Data Lifecycle</h3>
            <p className="text-sm text-muted-foreground">
              Documents automatically fragment into encrypted pieces upon upload and
              reconstitute only during authorized access.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-2">Story Authentication</h3>
            <p className="text-sm text-muted-foreground">
              AI-powered narrative analysis verifies identity through linguistic
              patterns and personal memory authenticity.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-2">Auto-Dissolution</h3>
            <p className="text-sm text-muted-foreground">
              Data automatically returns to liquid state after session ends,
              leaving no persistent plaintext traces.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
