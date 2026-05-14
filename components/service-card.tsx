import { PulseDot } from "./pulse-dot";
import { Activity, Cpu, MemoryStick, Clock, RotateCcw } from "lucide-react";

export type ServiceCardProps = {
  name: string;
  status: string;
  cpu?: number;
  memMb?: number;
  uptimeMs?: number;
  restarts?: number;
  badge?: string;
};

export function ServiceCard({
  name,
  status,
  cpu,
  memMb,
  uptimeMs,
  restarts,
  badge,
}: ServiceCardProps) {
  const ok = status === "online" || status === "reachable";
  const bad = status === "errored" || status === "stopped" || status === "down";
  const tone = ok ? "ok" : bad ? "bad" : "warn";

  return (
    <div className="relative overflow-hidden border border-neutral-800 rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-950 p-4 hover:border-neutral-700 transition-colors group">
      <div
        className={`absolute top-0 left-0 right-0 h-0.5 ${
          ok ? "bg-emerald-500" : bad ? "bg-red-500" : "bg-amber-500"
        }`}
      />
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <PulseDot tone={tone} />
            <div className="text-sm font-medium truncate">{name}</div>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1">
            {status}
            {badge && <span className="ml-2 text-neutral-600">· {badge}</span>}
          </div>
        </div>
        <Activity className="w-4 h-4 text-neutral-700 group-hover:text-neutral-500" />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {typeof cpu === "number" && (
          <Gauge icon={<Cpu className="w-3 h-3" />} label="CPU" value={cpu} max={100} unit="%" />
        )}
        {typeof memMb === "number" && (
          <Gauge
            icon={<MemoryStick className="w-3 h-3" />}
            label="MEM"
            value={memMb}
            max={Math.max(512, memMb * 1.2)}
            unit="MB"
            format={(v) => v.toFixed(0)}
          />
        )}
        {typeof uptimeMs === "number" && uptimeMs > 0 && (
          <div className="col-span-2 flex items-center gap-2 text-neutral-500">
            <Clock className="w-3 h-3" />
            <span>up {formatUptime(uptimeMs)}</span>
            {typeof restarts === "number" && restarts > 0 && (
              <span className="ml-auto flex items-center gap-1">
                <RotateCcw className="w-3 h-3" />
                {restarts}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Gauge({
  icon,
  label,
  value,
  max,
  unit,
  format,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  max: number;
  unit: string;
  format?: (v: number) => string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const tone = pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="flex items-center justify-between text-neutral-500 mb-1">
        <span className="flex items-center gap-1">
          {icon}
          {label}
        </span>
        <span className="text-neutral-300">
          {format ? format(value) : value.toFixed(0)}
          {unit}
        </span>
      </div>
      <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-full ${tone} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatUptime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ${min % 60}m`;
  const d = Math.floor(hr / 24);
  return `${d}d ${hr % 24}h`;
}
