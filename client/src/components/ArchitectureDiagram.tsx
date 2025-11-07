import { ArrowRight, Database, Lock, Unlock, RefreshCw } from "lucide-react";

export function ArchitectureDiagram() {
  return (
    <div className="w-full bg-card border border-card-border rounded-md p-8">
      <h3 className="text-lg font-semibold mb-6 text-center">Data Lifecycle Flow</h3>
      
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Solid State */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-md bg-primary/10 border-2 border-primary flex items-center justify-center">
            <Database className="w-10 h-10 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-mono text-xs text-primary mb-1">SOLID</p>
            <p className="text-xs text-muted-foreground">Original File</p>
          </div>
        </div>

        <ArrowRight className="w-6 h-6 text-muted-foreground rotate-90 md:rotate-0" />

        {/* Liquifying */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-md bg-chart-1/10 border-2 border-chart-1 flex items-center justify-center relative">
            <RefreshCw className="w-10 h-10 text-chart-1 animate-pulse-glow" />
          </div>
          <div className="text-center">
            <p className="font-mono text-xs text-chart-1 mb-1">LIQUIFYING</p>
            <p className="text-xs text-muted-foreground">Fragmenting + Encrypting</p>
          </div>
        </div>

        <ArrowRight className="w-6 h-6 text-muted-foreground rotate-90 md:rotate-0" />

        {/* Liquid State */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-md bg-chart-2/10 border-2 border-chart-2 flex items-center justify-center">
            <Lock className="w-10 h-10 text-chart-2" />
          </div>
          <div className="text-center">
            <p className="font-mono text-xs text-chart-2 mb-1">LIQUID</p>
            <p className="text-xs text-muted-foreground">Distributed Fragments</p>
          </div>
        </div>

        <ArrowRight className="w-6 h-6 text-muted-foreground rotate-90 md:rotate-0" />

        {/* Reconstituting */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-md bg-chart-3/10 border-2 border-chart-3 flex items-center justify-center">
            <RefreshCw className="w-10 h-10 text-chart-3 animate-pulse-glow" />
          </div>
          <div className="text-center">
            <p className="font-mono text-xs text-chart-3 mb-1">RECONSTITUTING</p>
            <p className="text-xs text-muted-foreground">Assembling + Decrypting</p>
          </div>
        </div>

        <ArrowRight className="w-6 h-6 text-muted-foreground rotate-90 md:rotate-0" />

        {/* Reconstituted */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-md bg-chart-4/10 border-2 border-chart-4 flex items-center justify-center">
            <Unlock className="w-10 h-10 text-chart-4" />
          </div>
          <div className="text-center">
            <p className="font-mono text-xs text-chart-4 mb-1">ACCESSIBLE</p>
            <p className="text-xs text-muted-foreground">Temporary Access</p>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-muted/50 rounded-md p-3">
            <p className="font-semibold mb-1">Upload Phase</p>
            <p className="text-muted-foreground">File fragmented into N encrypted pieces and distributed across multiple storage nodes</p>
          </div>
          <div className="bg-muted/50 rounded-md p-3">
            <p className="font-semibold mb-1">Storage Phase</p>
            <p className="text-muted-foreground">Fragments exist independently; no single location has complete data</p>
          </div>
          <div className="bg-muted/50 rounded-md p-3">
            <p className="font-semibold mb-1">Access Phase</p>
            <p className="text-muted-foreground">After authentication, fragments reconstitute temporarily then auto-dissolve</p>
          </div>
        </div>
      </div>
    </div>
  );
}
