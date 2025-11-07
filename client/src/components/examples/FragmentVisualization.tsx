import { useState } from 'react';
import { FragmentVisualization } from '../FragmentVisualization';
import { Button } from '@/components/ui/button';

export default function FragmentVisualizationExample() {
  const [state, setState] = useState<"solid" | "liquifying" | "liquid" | "reconstituting" | "reconstituted">("solid");

  return (
    <div className="p-8 space-y-4">
      <FragmentVisualization state={state} />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setState("solid")}>Solid</Button>
        <Button size="sm" onClick={() => setState("liquifying")}>Liquifying</Button>
        <Button size="sm" onClick={() => setState("liquid")}>Liquid</Button>
        <Button size="sm" onClick={() => setState("reconstituting")}>Reconstituting</Button>
        <Button size="sm" onClick={() => setState("reconstituted")}>Reconstituted</Button>
      </div>
    </div>
  );
}
