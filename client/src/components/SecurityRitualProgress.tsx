import { useState, useEffect, useRef } from "react";
import { ShieldCheck, Hash, Cpu, Lock } from "lucide-react";

interface SecurityRitualStep {
  label: string;
  icon: typeof ShieldCheck;
  duration: number;
}

const RITUAL_STEPS: SecurityRitualStep[] = [
  { label: "Validating commitment records...", icon: ShieldCheck, duration: 2000 },
  { label: "Computing SHA-256 + Pedersen hashes...", icon: Hash, duration: 3500 },
  { label: "Executing Noir zero-knowledge circuit...", icon: Cpu, duration: 6000 },
  { label: "Finalizing cryptographic proof...", icon: Lock, duration: 2500 },
];

const TOTAL_DURATION = RITUAL_STEPS.reduce((sum, s) => sum + s.duration, 0);

interface SecurityRitualProgressProps {
  isActive: boolean;
  onComplete?: () => void;
}

export default function SecurityRitualProgress({ isActive, onComplete }: SecurityRitualProgressProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      setCurrentStep(0);
      startTimeRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    startTimeRef.current = performance.now();

    function tick(now: number) {
      if (!startTimeRef.current) return;
      const elapsed = now - startTimeRef.current;
      const pct = Math.min((elapsed / TOTAL_DURATION) * 100, 100);
      setProgress(pct);

      let accumulated = 0;
      let step = 0;
      for (let i = 0; i < RITUAL_STEPS.length; i++) {
        accumulated += RITUAL_STEPS[i].duration;
        if (elapsed < accumulated) {
          step = i;
          break;
        }
        step = i;
      }
      setCurrentStep(step);

      if (pct < 100) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        onComplete?.();
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, onComplete]);

  if (!isActive) return null;

  const ActiveIcon = RITUAL_STEPS[currentStep].icon;

  return (
    <div className="space-y-4 p-4" data-testid="security-ritual-progress">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full border-2 border-primary flex items-center justify-center">
            <ActiveIcon className="w-5 h-5 text-primary animate-pulse" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" data-testid="text-ritual-step">
            {RITUAL_STEPS[currentStep].label}
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            Step {currentStep + 1} of {RITUAL_STEPS.length}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
            data-testid="progress-bar"
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{Math.round(progress)}%</span>
          <span className="font-mono">Zero-Knowledge Proof Engine</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {RITUAL_STEPS.map((step, i) => {
          const StepIcon = step.icon;
          const isComplete = i < currentStep;
          const isCurrent = i === currentStep;
          return (
            <div
              key={i}
              className={`flex flex-col items-center gap-1 p-2 rounded-md text-center ${
                isComplete
                  ? "text-primary"
                  : isCurrent
                  ? "text-primary"
                  : "text-muted-foreground/40"
              }`}
              data-testid={`ritual-step-${i}`}
            >
              <StepIcon className={`w-4 h-4 ${isCurrent ? "animate-pulse" : ""}`} />
              <span className="text-[10px] leading-tight">
                {step.label.replace("...", "").split(" ").slice(0, 2).join(" ")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
