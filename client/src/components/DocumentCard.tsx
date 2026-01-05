import { FileText, Download, Trash2, Eye, Lock } from "lucide-react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type DocumentStatus = "liquid" | "reconstituted" | "accessible";

interface DocumentCardProps {
  id: string;
  name: string;
  status: DocumentStatus;
  fragmentCount: number;
  lastAccessed?: string;
  size: string;
  onView: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onLock?: () => void;
}

const statusConfig = {
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
};

export function DocumentCard({
  name,
  status,
  fragmentCount,
  lastAccessed,
  size,
  onView,
  onDownload,
  onDelete,
  onLock,
}: DocumentCardProps) {
  const config = statusConfig[status];
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

      <CardContent className="pb-3">
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
