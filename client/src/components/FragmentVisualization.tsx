import { useState, useEffect } from "react";
import { Database, Server, Cloud } from "lucide-react";

interface Fragment {
  id: string;
  position: { x: number; y: number };
  node: string;
}

interface FragmentVisualizationProps {
  state: "solid" | "liquifying" | "liquid" | "reconstituting" | "reconstituted";
  fragmentCount?: number;
}

export function FragmentVisualization({
  state,
  fragmentCount = 8,
}: FragmentVisualizationProps) {
  const [fragments, setFragments] = useState<Fragment[]>([]);

  useEffect(() => {
    const nodePositions = [
      { x: 20, y: 20, node: "Node A" },
      { x: 80, y: 20, node: "Node B" },
      { x: 50, y: 50, node: "Node C" },
      { x: 20, y: 80, node: "Node D" },
      { x: 80, y: 80, node: "Node E" },
    ];

    const newFragments = Array.from({ length: fragmentCount }, (_, i) => ({
      id: `fragment-${i}`,
      position: nodePositions[i % nodePositions.length],
      node: nodePositions[i % nodePositions.length].node,
    }));

    setFragments(newFragments);
  }, [fragmentCount]);

  const getNodeIcon = (index: number) => {
    const icons = [Database, Server, Cloud];
    const Icon = icons[index % icons.length];
    return <Icon className="w-4 h-4" />;
  };

  return (
    <div className="relative w-full h-64 bg-card rounded-md border border-card-border p-6">
      <div className="absolute inset-0 overflow-hidden">
        {state === "solid" && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-16 h-16 bg-primary/20 rounded-md flex items-center justify-center border border-primary">
              <Database className="w-8 h-8 text-primary" />
            </div>
            <p className="text-xs text-center mt-2 font-mono text-muted-foreground">
              ORIGINAL FILE
            </p>
          </div>
        )}

        {(state === "liquifying" || state === "liquid") && (
          <>
            {fragments.map((fragment, i) => (
              <div
                key={fragment.id}
                className="absolute"
                style={{
                  left: `${fragment.position.x}%`,
                  top: `${fragment.position.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div
                  className={`w-8 h-8 bg-chart-1/20 rounded-sm border border-chart-1 flex items-center justify-center ${
                    state === "liquifying" ? "animate-pulse-glow" : ""
                  }`}
                >
                  {getNodeIcon(i)}
                </div>
                <p className="text-[10px] font-mono text-muted-foreground mt-1 text-center whitespace-nowrap">
                  {fragment.node}
                </p>
              </div>
            ))}
          </>
        )}

        {(state === "reconstituting" || state === "reconstituted") && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div
              className={`w-16 h-16 bg-primary/20 rounded-md flex items-center justify-center border border-primary ${
                state === "reconstituted" ? "ring-2 ring-primary/50 ring-offset-2" : "animate-pulse-glow"
              }`}
            >
              <Database className="w-8 h-8 text-primary" />
            </div>
            <p className="text-xs text-center mt-2 font-mono text-muted-foreground">
              {state === "reconstituted" ? "ACCESSIBLE" : "ASSEMBLING..."}
            </p>
          </div>
        )}
      </div>

      <div className="absolute bottom-2 right-2 flex items-center gap-2 text-xs text-muted-foreground">
        <div className="w-2 h-2 rounded-full bg-chart-1 animate-pulse-glow"></div>
        <span className="font-mono uppercase">{state}</span>
      </div>
    </div>
  );
}
