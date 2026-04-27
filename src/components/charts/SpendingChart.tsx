'use client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { MOCK_SPENDING_PREDICTIONS } from '@/lib/solana/mockData';

export function SpendingChart() {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={MOCK_SPENDING_PREDICTIONS} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" vertical={false} />
        <XAxis dataKey="period" tick={{ fill: '#4b4b60', fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: '#4b4b60', fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: '#13131a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#9ca3af' }}
        />
        <Bar dataKey="actual" name="Actual ($)" radius={[4, 4, 0, 0]} maxBarSize={20}>
          {MOCK_SPENDING_PREDICTIONS.map((_, i) => (
            <Cell key={i} fill={_.actual ? '#ff6b2b' : '#2a2a3a'} />
          ))}
        </Bar>
        <Bar dataKey="predicted" name="Predicted ($)" radius={[4, 4, 0, 0]} fill="#f4a93540" maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
