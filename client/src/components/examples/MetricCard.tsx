import { MetricCard } from '../MetricCard';
import { FileText, Lock, Activity, Database } from 'lucide-react';

export default function MetricCardExample() {
  return (
    <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl">
      <MetricCard
        title="Total Documents"
        value="24"
        icon={FileText}
        trend={{ value: "+12% this month", positive: true }}
      />
      <MetricCard
        title="Active Sessions"
        value="3"
        icon={Activity}
        iconColor="text-chart-2"
      />
      <MetricCard
        title="Fragments Stored"
        value="192"
        icon={Database}
        iconColor="text-chart-3"
      />
      <MetricCard
        title="Security Status"
        value="Secure"
        icon={Lock}
        iconColor="text-chart-4"
      />
    </div>
  );
}
