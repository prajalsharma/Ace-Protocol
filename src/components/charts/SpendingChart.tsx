'use client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useApp } from '@/context/AppContext';
import { useMemo } from 'react';

// Derive spending forecast from real scheduled payments — no static mock data
export function SpendingChart() {
  const { payments, transactions } = useApp();

  const data = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 2 + i, 1);
      return {
        period: d.toLocaleString('default', { month: 'short' }),
        monthStart: Math.floor(d.getTime() / 1000),
        monthEnd: Math.floor(new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime() / 1000),
        isPast: d < now,
      };
    });

    return months.map(({ period, monthStart, monthEnd, isPast }) => {
      // Actual: sum of completed payouts in this calendar month
      const actual = isPast
        ? transactions
            .filter(tx => tx.type === 'payout' && tx.status === 'confirmed'
              && tx.timestamp >= monthStart && tx.timestamp <= monthEnd)
            .reduce((s, tx) => s + tx.amountUsd, 0)
        : undefined;

      // Predicted: sum of scheduled payments whose nextDue falls in this month
      const predicted = payments
        .filter(p => p.status === 'scheduled' && p.nextDue >= monthStart && p.nextDue <= monthEnd)
        .reduce((s, p) => s + p.amountUsd, 0);

      return { period, actual, predicted };
    });
  }, [payments, transactions]);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" vertical={false} />
        <XAxis dataKey="period" tick={{ fill: '#4b4b60', fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: '#4b4b60', fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: '#13131a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#9ca3af' }}
          formatter={(v) => [`$${Number(v ?? 0).toFixed(2)}`, '']}
        />
        <Bar dataKey="actual" name="Actual ($)" radius={[4, 4, 0, 0]} maxBarSize={20}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.actual !== undefined && entry.actual > 0 ? '#9d5cff' : '#2a2a3a'} />
          ))}
        </Bar>
        <Bar dataKey="predicted" name="Predicted ($)" radius={[4, 4, 0, 0]} fill="#5bc8ff40" maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
