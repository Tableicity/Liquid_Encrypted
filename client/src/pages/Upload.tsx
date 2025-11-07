import { useState } from "react";
import { FileUploadZone } from "@/components/FileUploadZone";
import { FragmentVisualization } from "@/components/FragmentVisualization";
import { ChatInterface } from "@/components/ChatInterface";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface UploadProps {
  onNavigate: (page: "dashboard" | "documents") => void;
}

export default function Upload({ onNavigate }: UploadProps) {
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "liquifying" | "authenticating" | "complete"
  >("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setUploadState("uploading");
    
    // Simulate upload progress
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 10;
      setProgress(currentProgress);
      
      if (currentProgress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setUploadState("liquifying");
          setTimeout(() => {
            setUploadState("authenticating");
          }, 3000);
        }, 500);
      }
    }, 200);
  };

  const handleAuthSuccess = () => {
    setUploadState("complete");
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
        <h1 className="text-3xl font-bold mb-2">Upload & Liquify</h1>
        <p className="text-muted-foreground">
          Upload a document to fragment and encrypt it across distributed nodes
        </p>
      </div>

      {uploadState === "idle" && (
        <FileUploadZone onFileSelect={handleFileSelect} />
      )}

      {uploadState === "uploading" && selectedFile && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Uploading: {selectedFile.name}</h3>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="mb-2" />
            <p className="text-sm text-muted-foreground">
              Uploading file... {progress}%
            </p>
          </CardContent>
        </Card>
      )}

      {uploadState === "liquifying" && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Liquifying Document</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <FragmentVisualization state="liquifying" fragmentCount={8} />
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                ✓ File fragmented into 8 encrypted pieces
              </p>
              <p className="text-muted-foreground">
                ✓ Distributing across multiple storage nodes...
              </p>
              <p className="text-muted-foreground animate-pulse-glow">
                • Finalizing encryption layers...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadState === "authenticating" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-chart-3/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-chart-3" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Document Successfully Liquified</h3>
                  <p className="text-sm text-muted-foreground">
                    Your document has been fragmented into 8 encrypted pieces and distributed
                    across multiple nodes. To access it later, you'll need to authenticate.
                  </p>
                </div>
              </div>
              <FragmentVisualization state="liquid" fragmentCount={8} />
            </CardContent>
          </Card>

          <ChatInterface onAuthSuccess={handleAuthSuccess} />
        </div>
      )}

      {uploadState === "complete" && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-chart-3/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-chart-3" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Upload Complete!</h3>
            <p className="text-muted-foreground mb-6">
              Your document has been successfully liquified and stored securely.
              You can now access it from your documents library.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => {
                  setUploadState("idle");
                  setSelectedFile(null);
                  setProgress(0);
                }}
                data-testid="button-upload-another"
              >
                Upload Another
              </Button>
              <Button
                variant="outline"
                onClick={() => onNavigate("documents")}
                data-testid="button-view-documents"
              >
                View Documents
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
