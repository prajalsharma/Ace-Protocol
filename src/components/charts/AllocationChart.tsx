'use client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Vault } from '@/types';

const COLORS = ['#10b981', '#f4a935', '#ff6b2b', '#0ea5e9'];
const LABELS = ['Earning Yield', 'Reserved', 'Spendable', 'Payments'];

export function AllocationChart({ vault }: { vault: Vault }) {
  const data = [
    { name: LABELS[0], value: vault.yieldBalance },
    { name: LABELS[1], value: vault.reserveBalance },
    { name: LABELS[2], value: vault.liquidBalance },
    { name: LABELS[3], value: vault.paymentsBalance },
  ];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i]} opacity={0.85} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#13131a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
          formatter={(v: number) => [`$${v.toLocaleString()}`, '']}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#6b6b80' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
