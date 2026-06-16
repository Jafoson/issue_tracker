"use client";

import { useWorkspace } from "@/lib/workspace-context";

// ---- Status icon: Linear-style ring that fills with progress ----
export function StatusIcon({ status, size = 15 }: { status: string; size?: number }) {
  const { statuses } = useWorkspace();
  const s = statuses.find((x) => x.id === status);
  const c = s?.color ?? "#8a9099";
  const r = 6.2, cx = 8, cy = 8, C = 2 * Math.PI * r;
  const prog: Record<string, number> = { backlog: 0, todo: 0, in_progress: 0.45, in_review: 0.7, done: 1, canceled: 1 };
  const p = prog[status] ?? 0;

  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ flex: "none", display: "block" }}>
      {status === "backlog" ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth="1.6" strokeDasharray="1.6 2.4" opacity=".8"/>
      ) : (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth="1.6" opacity={status === "done" || status === "canceled" ? 1 : .5}/>
      )}
      {status === "done" && (
        <>
          <circle cx={cx} cy={cy} r={r} fill={c} opacity=".18"/>
          <path d="M5.2 8.2 7 10l3.6-3.8" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      )}
      {status === "canceled" && (
        <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
      )}
      {(status === "in_progress" || status === "in_review") && (
        <circle cx={cx} cy={cy} r={r / 2} fill="none" stroke={c} strokeWidth={r}
          strokeDasharray={`${C * p / 2} ${C}`} transform={`rotate(-90 ${cx} ${cy})`} opacity=".95"/>
      )}
    </svg>
  );
}

// ---- Priority icon: Linear-style bars ----
export function PriorityIcon({ priority, size = 15 }: { priority: number; size?: number }) {
  const p = typeof priority === "number" ? priority : 0;

  if (p === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" style={{ flex: "none", display: "block" }}>
        {[3, 7.5, 12].map((x) => (
          <rect key={x} x={x} y="7" width="3" height="2" rx="1" fill="var(--text-3)"/>
        ))}
      </svg>
    );
  }
  if (p === 4) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" style={{ flex: "none", display: "block" }}>
        <rect x="1.5" y="1.5" width="13" height="13" rx="3.5" fill="#e0992b"/>
        <rect x="7" y="4" width="2" height="5.2" rx="1" fill="#fff"/>
        <rect x="7" y="10.6" width="2" height="2" rx="1" fill="#fff"/>
      </svg>
    );
  }

  const bars = [
    { x: 2.5, h: 5,  y: 9 },
    { x: 6.5, h: 8,  y: 6 },
    { x: 10.5, h: 11, y: 3 },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ flex: "none", display: "block" }}>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width="3" height={b.h} rx="1"
          fill={i < p ? "var(--text)" : "var(--text-3)"} opacity={i < p ? 1 : .35}/>
      ))}
    </svg>
  );
}

// ---- Type icon: geometric glyph per issue type ----
export function TypeIcon({ type, size = 14, color }: { type: string; size?: number; color?: string }) {
  const { issueTypes } = useWorkspace();
  const t = issueTypes.find((x) => x.id === type);
  const c = color ?? t?.color ?? "#686d76";
  const common = { width: size, height: size, viewBox: "0 0 16 16", style: { flex: "none", display: "block" } };

  if (type === "feature")
    return <svg {...common}><path d="M8 1.4 14.6 8 8 14.6 1.4 8Z" fill={c}/></svg>;
  if (type === "bug")
    return <svg {...common}><circle cx="8" cy="8" r="5.4" fill="none" stroke={c} strokeWidth="2"/><circle cx="8" cy="8" r="1.8" fill={c}/></svg>;
  if (type === "improvement")
    return <svg {...common}><path d="M8 2.2 14.2 13.4H1.8Z" fill={c}/></svg>;
  if (type === "task")
    return <svg {...common}><rect x="2.3" y="2.3" width="11.4" height="11.4" rx="3.2" fill={c}/><path d="M5.2 8 7.2 10 11 5.8" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  // chore / fallback
  return <svg {...common}><rect x="2.6" y="2.6" width="10.8" height="10.8" rx="3" fill="none" stroke={c} strokeWidth="2"/></svg>;
}
