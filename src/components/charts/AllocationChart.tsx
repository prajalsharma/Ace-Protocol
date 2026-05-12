'use client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { Vault } from '@/types';

const COLORS = ['#10d98c', '#f59e0b', '#fb923c', '#3b82f6'];
const LABELS = ['Earning Yield', 'Reserved', 'Spendable', 'Payments'];

// Center label rendered as a custom active shape via the label prop
function renderCenterLabel(props: { cx: number; cy: number; total: number }) {
  const { cx, cy, total } = props;
  const fmt = total >= 1000
    ? `$${(total / 1000).toFixed(1)}k`
    : `$${total.toFixed(0)}`;
  return (
    <g>
      <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)"
        style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 600 }}>
        {fmt}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--text-muted)"
        style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em' }}>
        TOTAL
      </text>
    </g>
  );
}

export function AllocationChart({ vault }: { vault: Vault }) {
  const data = [
    { name: LABELS[0], value: vault.yieldBalance },
    { name: LABELS[1], value: vault.reserveBalance },
    { name: LABELS[2], value: vault.liquidBalance },
    { name: LABELS[3], value: vault.paymentsBalance },
  ].filter(d => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <defs>
          {COLORS.map((c, i) => (
            <radialGradient key={i} id={`alloc-grad-${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={c} stopOpacity={1} />
              <stop offset="100%" stopColor={c} stopOpacity={0.7} />
            </radialGradient>
          ))}
        </defs>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={80}
          outerRadius={110}
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
          animationBegin={100}
          animationDuration={1200}
          animationEasing="ease-out"
          // Render a static center label via the label prop on a dummy point
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={COLORS[i % COLORS.length]}
              opacity={0.9}
            />
          ))}
        </Pie>
        {/* Center label via foreignObject workaround is complex — use SVG overlay instead */}
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
          fill="var(--text-primary)"
          style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 600 }}>
          {total >= 1000 ? `$${(total / 1000).toFixed(1)}k` : `$${total.toFixed(0)}`}
        </text>
        <Tooltip
          contentStyle={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-base)',
            borderRadius: 10,
            fontSize: 13,
            color: 'var(--text-primary)',
          }}
          formatter={(v) => [`$${Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, '']}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
