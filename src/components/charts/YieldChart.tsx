'use client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { MOCK_YIELD_HISTORY } from '@/lib/solana/mockData';

export function YieldChart() {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={MOCK_YIELD_HISTORY} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: '#4b4b60', fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
        <YAxis tick={{ fill: '#4b4b60', fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: '#13131a', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#9ca3af' }}
          itemStyle={{ color: '#10b981' }}
        />
        <Area type="monotone" dataKey="cumulative" stroke="#10b981" strokeWidth={2} fill="url(#yieldGrad)" dot={false} name="Cumulative Yield ($)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
