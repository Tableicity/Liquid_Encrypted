import { FileText, Download, Trash2, Eye, Lock, Brain, Shield, Globe } from "lucide-react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DocumentMetadata {
  classification: string;
  tags: string[];
  summary: string;
  keyEntities: string[];
  confidentialityLevel: string;
  language: string;
}

interface DocumentCardProps {
  id: string;
  name: string;
  status: string;
  fragmentCount: number;
  lastAccessed?: string;
  size: string;
  metadata?: DocumentMetadata | null;
  onView: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onLock?: () => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Lock }> = {
  liquid: {
    label: "Liquid",
    color: "bg-chart-1/10 text-chart-1 border-chart-1/20",
    icon: Lock,
  },
  reconstituted: {
    label: "Reconstituted",
    color: "bg-chart-2/10 text-chart-2 border-chart-2/20",
    icon: Eye,
  },
  accessible: {
    label: "Accessible",
    color: "bg-chart-3/10 text-chart-3 border-chart-3/20",
    icon: Eye,
  },
  solid: {
    label: "Solid",
    color: "bg-muted text-muted-foreground border-muted",
    icon: FileText,
  },
  liquified: {
    label: "Liquified",
    color: "bg-chart-1/10 text-chart-1 border-chart-1/20",
    icon: Lock,
  },
};

const defaultStatusConfig = {
  label: "Unknown",
  color: "bg-muted text-muted-foreground border-muted",
  icon: FileText,
};

const confidentialityColors: Record<string, string> = {
  public: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  internal: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  confidential: "bg-chart-5/10 text-chart-5 border-chart-5/20",
  highly_confidential: "bg-destructive/10 text-destructive border-destructive/20",
};

const classificationLabels: Record<string, string> = {
  financial: "Financial",
  legal: "Legal",
  technical: "Technical",
  medical: "Medical",
  personal: "Personal",
  corporate: "Corporate",
  academic: "Academic",
  government: "Government",
  correspondence: "Correspondence",
  other: "General",
};

export function DocumentCard({
  name,
  status,
  fragmentCount,
  lastAccessed,
  size,
  metadata,
  onView,
  onDownload,
  onDelete,
  onLock,
}: DocumentCardProps) {
  const config = statusConfig[status] || defaultStatusConfig;
  const StatusIcon = config.icon;

  return (
    <Card className="hover-elevate" data-testid={`card-document-${name}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate" title={name}>
              {name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{size}</p>
          </div>
        </div>
        <Badge variant="outline" className={`${config.color} border flex-shrink-0`}>
          <StatusIcon className="w-3 h-3 mr-1" />
          {config.label}
        </Badge>
      </CardHeader>

      <CardContent className="pb-3 space-y-2">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="font-mono">{fragmentCount}</span>
            <span>fragments</span>
          </div>
          {lastAccessed && (
            <div className="flex items-center gap-1">
              <span>Last accessed:</span>
              <span className="font-mono">{lastAccessed}</span>
            </div>
          )}
        </div>

        {metadata && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {metadata.classification && (
                <Badge variant="secondary" className="text-[10px] h-5" data-testid={`badge-classification-${metadata.classification}`}>
                  <Brain className="w-2.5 h-2.5 mr-0.5" />
                  {classificationLabels[metadata.classification] || metadata.classification}
                </Badge>
              )}
              {metadata.confidentialityLevel && (
                <Badge variant="outline" className={`text-[10px] h-5 border ${confidentialityColors[metadata.confidentialityLevel] || ""}`} data-testid="badge-confidentiality">
                  <Shield className="w-2.5 h-2.5 mr-0.5" />
                  {metadata.confidentialityLevel.replace("_", " ")}
                </Badge>
              )}
              {metadata.language && metadata.language !== "english" && (
                <Badge variant="outline" className="text-[10px] h-5" data-testid="badge-language">
                  <Globe className="w-2.5 h-2.5 mr-0.5" />
                  {metadata.language}
                </Badge>
              )}
            </div>

            {metadata.tags && metadata.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {metadata.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground" data-testid={`tag-${tag}`}>
                    {tag}
                  </span>
                ))}
                {metadata.tags.length > 4 && (
                  <span className="text-[10px] text-muted-foreground">+{metadata.tags.length - 4}</span>
                )}
              </div>
            )}

            {metadata.summary && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 cursor-default" data-testid="text-summary">
                    {metadata.summary}
                  </p>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">{metadata.summary}</p>
                  {metadata.keyEntities && metadata.keyEntities.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Key entities: {metadata.keyEntities.join(", ")}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2 pt-3 border-t">
        <Button
          size="sm"
          variant="outline"
          onClick={onView}
          data-testid="button-view"
          className="flex-1"
        >
          <Eye className="w-3 h-3 mr-1" />
          View
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDownload}
          data-testid="button-download"
        >
          <Download className="w-3 h-3" />
        </Button>
        {status === "accessible" && onLock && (
          <Button
            size="sm"
            variant="outline"
            onClick={onLock}
            data-testid="button-lock"
            title="Return to liquid state"
          >
            <Lock className="w-3 h-3" />
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onDelete}
          data-testid="button-delete"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </CardFooter>
    </Card>
  );
}
