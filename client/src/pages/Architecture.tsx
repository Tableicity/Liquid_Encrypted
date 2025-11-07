import { ArrowLeft, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ArchitectureProps {
  onNavigate: (page: "dashboard") => void;
}

export default function Architecture({ onNavigate }: ArchitectureProps) {
  const handleDownload = (format: "pdf" | "markdown") => {
    console.log(`Downloading architecture document as ${format}`);
    // In real app, would generate and download the document
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload("markdown")}
            data-testid="button-download-md"
          >
            <FileText className="w-4 h-4 mr-2" />
            Download MD
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload("pdf")}
            data-testid="button-download-pdf"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold mb-2">System Architecture</h1>
        <p className="text-muted-foreground">
          Comprehensive documentation of the Liquid Encrypted Data System
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lifecycle">Data Lifecycle</TabsTrigger>
          <TabsTrigger value="distribution">Fragment Distribution</TabsTrigger>
          <TabsTrigger value="encryption">Encryption Protocol</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">System Overview</h2>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p className="text-muted-foreground">
                The Liquid Encrypted Data System represents a paradigm shift in data security,
                addressing the quantum threat through innovative fragmentation and story-based
                authentication mechanisms.
              </p>
              
              <h3 className="text-base font-semibold mt-4 mb-2">Core Principles</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>
                  <strong>Never Whole:</strong> Data fragments are never fully accessible in any
                  single location, eliminating single points of compromise
                </li>
                <li>
                  <strong>Temporal Access:</strong> Reconstituted data exists only during active
                  sessions and automatically dissolves afterward
                </li>
                <li>
                  <strong>Cognitive Authentication:</strong> Story-based verification leverages
                  human memory and linguistic patterns that resist quantum attacks
                </li>
                <li>
                  <strong>Distributed Trust:</strong> Fragment distribution across multiple nodes
                  ensures no single provider has complete data
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Key Components</h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-muted/50 rounded-md">
                  <h4 className="font-semibold mb-2">Fragment Engine</h4>
                  <p className="text-sm text-muted-foreground">
                    Breaks files into encrypted pieces with configurable redundancy and
                    distribution strategies
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-md">
                  <h4 className="font-semibold mb-2">Storage Interface</h4>
                  <p className="text-sm text-muted-foreground">
                    Abstraction layer supporting multiple cloud providers (Google Drive, Dropbox,
                    OneDrive, etc.)
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-md">
                  <h4 className="font-semibold mb-2">Authentication Layer</h4>
                  <p className="text-sm text-muted-foreground">
                    AI-powered narrative analysis using OpenAI for story-based user verification
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-md">
                  <h4 className="font-semibold mb-2">Reconstitution Engine</h4>
                  <p className="text-sm text-muted-foreground">
                    Real-time assembly system with automatic session management and dissolution
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lifecycle" className="space-y-6 mt-6">
          <ArchitectureDiagram />

          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">State Transitions</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-mono text-sm text-primary mb-1">SOLID → LIQUIFYING</h4>
                  <p className="text-sm text-muted-foreground">
                    Original file is analyzed, fragmented into N pieces, and each fragment is
                    independently encrypted with unique keys
                  </p>
                </div>
                <div className="border-l-4 border-chart-1 pl-4">
                  <h4 className="font-mono text-sm text-chart-1 mb-1">LIQUIFYING → LIQUID</h4>
                  <p className="text-sm text-muted-foreground">
                    Encrypted fragments are distributed across multiple storage nodes with
                    metadata tracking but no centralized assembly instructions
                  </p>
                </div>
                <div className="border-l-4 border-chart-2 pl-4">
                  <h4 className="font-mono text-sm text-chart-2 mb-1">
                    LIQUID → RECONSTITUTING
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    After successful authentication, fragments are retrieved from distributed
                    nodes and decryption begins
                  </p>
                </div>
                <div className="border-l-4 border-chart-3 pl-4">
                  <h4 className="font-mono text-sm text-chart-3 mb-1">
                    RECONSTITUTING → ACCESSIBLE
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Fragments are assembled in memory, creating a temporary accessible state with
                    automatic session timeout
                  </p>
                </div>
                <div className="border-l-4 border-chart-4 pl-4">
                  <h4 className="font-mono text-sm text-chart-4 mb-1">
                    ACCESSIBLE → LIQUID (Auto-Dissolution)
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    When session ends or times out, assembled data is cleared from memory and
                    fragments return to distributed liquid state
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Fragment Distribution Strategy</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Multi-Provider Distribution</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Fragments are distributed across different cloud storage providers to eliminate
                  single-provider risk:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Google Drive (Fragments 1, 4, 7)</li>
                  <li>Dropbox (Fragments 2, 5, 8)</li>
                  <li>OneDrive (Fragments 3, 6)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Redundancy Configuration</h4>
                <p className="text-sm text-muted-foreground">
                  Each fragment can optionally be replicated across N nodes for disaster recovery,
                  while maintaining the security guarantee that no single node ever has enough
                  fragments to reconstruct the original file.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Fragment Metadata</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Metadata stored separately from fragments includes:
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-muted/50 p-3 rounded-md">
                  <div>Fragment ID</div>
                  <div>Storage Node Location</div>
                  <div>Encryption Algorithm</div>
                  <div>Fragment Size</div>
                  <div>Checksum/Hash</div>
                  <div>Creation Timestamp</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="encryption" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Encryption Flow</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Multi-Layer Encryption</h4>
                <div className="space-y-3">
                  <div className="border border-border rounded-md p-3">
                    <p className="font-mono text-xs text-primary mb-1">Layer 1: File Encryption</p>
                    <p className="text-sm text-muted-foreground">
                      Original file encrypted with AES-256 before fragmentation
                    </p>
                  </div>
                  <div className="border border-border rounded-md p-3">
                    <p className="font-mono text-xs text-chart-1 mb-1">
                      Layer 2: Fragment Encryption
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Each fragment individually encrypted with unique keys derived from master key
                    </p>
                  </div>
                  <div className="border border-border rounded-md p-3">
                    <p className="font-mono text-xs text-chart-2 mb-1">
                      Layer 3: Transport Encryption
                    </p>
                    <p className="text-sm text-muted-foreground">
                      TLS encryption during transit to storage nodes
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Key Management</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Encryption keys are never stored with fragments. Key derivation follows this
                  protocol:
                </p>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>User authentication generates session key</li>
                  <li>Master key derived from user credentials + session data</li>
                  <li>Fragment keys derived from master key using KDF</li>
                  <li>Keys exist only in memory during active session</li>
                  <li>All keys destroyed upon session termination</li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Decryption Protocol</h4>
                <p className="text-sm text-muted-foreground">
                  Decryption occurs only after successful story-based authentication. Fragments
                  are retrieved, decrypted in memory, and assembled without ever creating
                  unencrypted storage artifacts. The reconstituted file exists purely in
                  application memory and is automatically purged on session end.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Quantum Resistance</h2>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                While quantum computers threaten traditional cryptographic systems, the Liquid
                Encrypted approach provides additional defensive layers:
              </p>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>
                  Story-based authentication resists quantum attacks on password hashing
                </li>
                <li>
                  Distributed fragments prevent harvest-now-decrypt-later attacks
                </li>
                <li>
                  Temporal access limits quantum decryption window
                </li>
                <li>Migration path to post-quantum algorithms without data re-upload</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
