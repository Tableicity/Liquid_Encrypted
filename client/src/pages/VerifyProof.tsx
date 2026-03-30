import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Fingerprint, Loader2, CheckCircle2, XCircle, Clock, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface VerifyProofProps {
  onNavigate: (page: string) => void;
}

interface VerifyResult {
  valid?: boolean;
  reason?: string;
  expired?: boolean;
  proofId?: string;
  expiresAt?: string;
  status?: string;
}

export default function VerifyProof({ onNavigate }: VerifyProofProps) {
  const [proofId, setProofId] = useState("");
  const [verifyMode, setVerifyMode] = useState<"authenticated" | "public">("authenticated");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const { toast } = useToast();

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const endpoint = verifyMode === "public"
        ? "/api/proofs/verify/public"
        : "/api/proofs/verify";
      const res = await apiRequest("POST", endpoint, { proofId });
      return res.json() as Promise<VerifyResult>;
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
      setResult(null);
    },
  });

  const getStatusDisplay = () => {
    if (!result) return null;

    if (result.status) {
      switch (result.status) {
        case "valid":
          return { icon: CheckCircle2, label: "Valid", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30" };
        case "expired":
          return { icon: Clock, label: "Expired", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" };
        case "invalid":
          return { icon: XCircle, label: "Invalid", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30" };
        case "not_found":
          return { icon: Search, label: "Not Found", color: "text-muted-foreground", bg: "bg-muted" };
        default:
          return null;
      }
    }

    if (result.expired) {
      return { icon: Clock, label: "Expired", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" };
    }
    if (result.valid) {
      return { icon: CheckCircle2, label: "Valid", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30" };
    }
    return { icon: XCircle, label: "Invalid", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30" };
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="space-y-8" data-testid="verify-proof-page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">Verify Proof</h1>
        <p className="text-muted-foreground mt-1">
          Verify the validity of a zero-knowledge proof. Public verification requires no authentication.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="w-5 h-5" />
              Proof Verification
            </CardTitle>
            <CardDescription>
              Enter a proof ID to verify its validity and expiration status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Verification Mode</Label>
              <div className="flex gap-2">
                <Button
                  variant={verifyMode === "authenticated" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVerifyMode("authenticated")}
                  data-testid="button-mode-authenticated"
                  className="toggle-elevate"
                >
                  Authenticated
                </Button>
                <Button
                  variant={verifyMode === "public" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVerifyMode("public")}
                  data-testid="button-mode-public"
                  className="toggle-elevate"
                >
                  Public
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {verifyMode === "public"
                  ? "Anyone can verify — returns status only (valid/invalid/expired)."
                  : "Full verification with proof details, requires login."
                }
              </p>
            </div>

            <div className="space-y-2">
              <Label>Proof ID</Label>
              <Input
                placeholder="Enter proof ID (UUID)"
                value={proofId}
                onChange={(e) => {
                  setProofId(e.target.value);
                  setResult(null);
                }}
                data-testid="input-proof-id"
              />
            </div>

            <Button
              onClick={() => verifyMutation.mutate()}
              disabled={!proofId.trim() || verifyMutation.isPending}
              className="w-full"
              data-testid="button-verify-proof"
            >
              {verifyMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </span>
              ) : (
                "Verify Proof"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verification Result</CardTitle>
            <CardDescription>
              The outcome of the proof verification check.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!result && !verifyMutation.isPending && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Fingerprint className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm">Enter a proof ID and click verify to see results.</p>
              </div>
            )}

            {verifyMutation.isPending && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 mb-4 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Verifying proof...</p>
              </div>
            )}

            {result && statusDisplay && (
              <div className={`rounded-md p-6 ${statusDisplay.bg}`} data-testid="verify-result">
                <div className="flex items-center gap-3 mb-4">
                  <statusDisplay.icon className={`w-8 h-8 ${statusDisplay.color}`} />
                  <div>
                    <p className={`text-lg font-semibold ${statusDisplay.color}`} data-testid="text-verify-status">
                      {statusDisplay.label}
                    </p>
                    {result.reason && (
                      <p className="text-sm text-muted-foreground">{result.reason}</p>
                    )}
                  </div>
                </div>

                {result.expiresAt && (
                  <div className="flex items-center gap-2 mt-3 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Expires: {new Date(result.expiresAt).toLocaleString()}
                    </span>
                  </div>
                )}

                {result.proofId && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground">Proof ID</p>
                    <p className="font-mono text-xs mt-0.5 break-all" data-testid="text-proof-id">{result.proofId}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
