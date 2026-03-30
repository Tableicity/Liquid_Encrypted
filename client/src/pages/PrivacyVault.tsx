import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ShieldCheck, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Document } from "@shared/schema";

interface PrivacyVaultProps {
  onNavigate: (page: string) => void;
}

interface Commitment {
  id: string;
  documentId: string;
  commitmentHash: string;
  authenticityScore: number;
  createdAt: string;
  expiresAt?: string;
}

interface ProofResponse {
  proofRequest: {
    id: string;
    status: string;
    commitmentId: string;
    threshold: number;
  };
  proof: {
    id: string;
    verified: boolean;
    publicInputsHash: string;
    ttlHours: number;
    expiresAt: string;
    createdAt: string;
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PrivacyVault({ onNavigate }: PrivacyVaultProps) {
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [authenticityScore, setAuthenticityScore] = useState<number>(85);
  const [threshold, setThreshold] = useState<number[]>([70]);
  const [selectedCommitmentId, setSelectedCommitmentId] = useState<string>("");
  const { toast } = useToast();

  const { data: documents = [], isLoading: docsLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const { data: commitmentsData, isLoading: commitmentsLoading } = useQuery<{ commitments: Commitment[] }>({
    queryKey: ["/api/proofs/commitments"],
  });

  const commitments = commitmentsData?.commitments || [];

  const createCommitmentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/proofs/commitments", {
        documentId: selectedDocId,
        authenticityScore,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Commitment Created",
        description: `Hash: ${data.commitment.commitmentHash.slice(0, 16)}...`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/proofs/commitments"] });
      setSelectedDocId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create commitment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateProofMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/proofs/generate", {
        commitmentId: selectedCommitmentId,
        threshold: threshold[0],
      });
      return res.json() as Promise<ProofResponse>;
    },
    onSuccess: (data) => {
      toast({
        title: data.proof.verified ? "Proof Verified" : "Proof Generated (Below Threshold)",
        description: data.proof.verified
          ? `Document meets the ${threshold[0]}% authenticity threshold.`
          : `Document scored below the ${threshold[0]}% threshold.`,
        variant: data.proof.verified ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/proofs/commitments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/proofs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/proofs/usage/current"] });
      setSelectedCommitmentId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Proof generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const liquidDocs = documents.filter((d) => d.status === "liquified");

  return (
    <div className="space-y-8" data-testid="privacy-vault-page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">Privacy Vault</h1>
        <p className="text-muted-foreground mt-1">
          Generate zero-knowledge proofs for document authenticity without revealing contents.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Create Commitment
            </CardTitle>
            <CardDescription>
              Select a liquified document and set its authenticity score to create a cryptographic commitment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Document</Label>
              {docsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading documents...
                </div>
              ) : liquidDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No liquified documents found. Upload and encrypt a document first.
                </p>
              ) : (
                <Select value={selectedDocId} onValueChange={setSelectedDocId}>
                  <SelectTrigger data-testid="select-document">
                    <SelectValue placeholder="Select a document" />
                  </SelectTrigger>
                  <SelectContent>
                    {liquidDocs.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id} data-testid={`option-doc-${doc.id}`}>
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          {doc.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Authenticity Score (0-100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={authenticityScore}
                onChange={(e) => setAuthenticityScore(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                data-testid="input-authenticity-score"
              />
              <p className="text-xs text-muted-foreground">
                How authentic is this document? This score will be committed but never revealed.
              </p>
            </div>

            <Button
              onClick={() => createCommitmentMutation.mutate()}
              disabled={!selectedDocId || createCommitmentMutation.isPending}
              className="w-full"
              data-testid="button-create-commitment"
            >
              {createCommitmentMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </span>
              ) : (
                "Create Commitment"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Generate Proof
            </CardTitle>
            <CardDescription>
              Prove a document meets the authenticity threshold without revealing the actual score.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Commitment</Label>
              {commitmentsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : commitments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No commitments yet. Create one first.
                </p>
              ) : (
                <Select value={selectedCommitmentId} onValueChange={setSelectedCommitmentId}>
                  <SelectTrigger data-testid="select-commitment">
                    <SelectValue placeholder="Select a commitment" />
                  </SelectTrigger>
                  <SelectContent>
                    {commitments.map((c) => (
                      <SelectItem key={c.id} value={c.id} data-testid={`option-commitment-${c.id}`}>
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs">{c.commitmentHash.slice(0, 12)}...</span>
                          <Badge variant="secondary" className="text-xs">
                            Score: {c.authenticityScore}
                          </Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Threshold: {threshold[0]}%</Label>
              <Slider
                value={threshold}
                onValueChange={setThreshold}
                min={1}
                max={100}
                step={1}
                data-testid="slider-threshold"
              />
              <p className="text-xs text-muted-foreground">
                The proof will verify whether the document's score meets or exceeds this threshold.
              </p>
            </div>

            <Button
              onClick={() => generateProofMutation.mutate()}
              disabled={!selectedCommitmentId || generateProofMutation.isPending}
              className="w-full"
              data-testid="button-generate-proof"
            >
              {generateProofMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </span>
              ) : (
                "Generate Proof"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {commitments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Commitments</CardTitle>
            <CardDescription>Your cryptographic commitments for document authenticity.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {commitments.slice(0, 10).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-md border"
                  data-testid={`commitment-row-${c.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm truncate">{c.commitmentHash}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(c.createdAt)}</p>
                  </div>
                  <Badge variant="outline" data-testid={`badge-score-${c.id}`}>
                    Score: {c.authenticityScore}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
