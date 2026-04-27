'use client';
import { Lightbulb, AlertTriangle, TrendingUp, X, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useApp } from '@/context/AppContext';
import type { CashflowInsight } from '@/types';
import { cn } from '@/lib/utils';

const typeIcon: Record<string, React.ReactNode> = {
  recommendation: <Lightbulb className="w-4 h-4 text-yellow-400" />,
  alert:          <AlertTriangle className="w-4 h-4 text-orange-400" />,
  prediction:     <TrendingUp className="w-4 h-4 text-sky-400" />,
};

const impactVariant: Record<string, 'fire' | 'gold' | 'ocean' | 'muted'> = {
  high:   'fire',
  medium: 'gold',
  low:    'ocean',
};

export function InsightsFeed() {
  const { insights, dismissInsight } = useApp();

  if (!insights.length) {
    return (
      <Card>
        <CardHeader><CardTitle>AI Crew Insights</CardTitle></CardHeader>
        <p className="text-sm text-gray-600 text-center py-6">All clear — no active recommendations.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Crew Insights</CardTitle>
        <Badge variant="fire">{insights.length} active</Badge>
      </CardHeader>
      <div className="space-y-3">
        {insights.map(insight => (
          <InsightItem key={insight.id} insight={insight} onDismiss={dismissInsight} />
        ))}
      </div>
    </Card>
  );
}

function InsightItem({ insight, onDismiss }: { insight: CashflowInsight; onDismiss: (id: string) => void }) {
  return (
    <div className={cn(
      'flex gap-3 p-3 rounded-lg border transition-all',
      insight.type === 'alert'
        ? 'bg-orange-500/5 border-orange-500/20'
        : 'bg-white/3 border-[#2a2a3a]',
    )}>
      <div className="mt-0.5 shrink-0">{typeIcon[insight.type]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-white">{insight.title}</p>
          <button onClick={() => onDismiss(insight.id)} className="text-gray-600 hover:text-gray-400 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{insight.description}</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant={impactVariant[insight.impact]}>{insight.impact} impact</Badge>
          <span className="text-[10px] text-gray-600">{(insight.confidence * 100).toFixed(0)}% confidence</span>
          {insight.action && (
            <button className="ml-auto flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors">
              {insight.action.label} <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
