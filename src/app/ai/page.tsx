'use client';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SpendingChart } from '@/components/charts/SpendingChart';
import { useApp } from '@/context/AppContext';
import { formatUsd } from '@/lib/utils';
import {
  Cpu, Lightbulb, AlertTriangle, TrendingUp, ShieldCheck, Zap,
  Lock, CheckCircle2, Loader2, ChevronRight, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AIPage() {
  const { insights, vault, dismissInsight, isLoading } = useApp();

  if (isLoading) return (
    <AppShell>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-5">

        {/* AI crew header */}
        <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-900/15 via-[#13131a] to-[#0c0c13] p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 flex items-center justify-center shrink-0 gold-glow">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Your AI Crew</h2>
              <p className="text-gray-400 text-sm mt-1">
                Cashflow intelligence that recommends actions within your policy guardrails.
                The crew never moves funds without your authorization.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400">All actions bounded by policy constraints</span>
              </div>
            </div>
          </div>
        </div>

        {/* Guardrails */}
        <Card>
          <CardHeader><CardTitle>Active Guardrails</CardTitle></CardHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: 'Min reserve ratio',       value: '15%',   desc: 'Reserve never drops below this' },
              { label: 'Max yield allocation',     value: '80%',   desc: 'Capital ceiling for yield strategies' },
              { label: 'Max rebalance per action', value: '15%',   desc: 'Single-step shift limit' },
              { label: 'Manual approval above',    value: '$500',  desc: 'Requires your confirmation' },
              { label: 'Max execution cost',       value: '$2.00', desc: 'Skip action if fees too high' },
              { label: 'Oracle staleness limit',   value: '10 slots', desc: 'Reject stale price data' },
            ].map(({ label, value, desc }) => (
              <div key={label} className="flex items-start gap-3 p-3 rounded-lg border border-[#2a2a3a] bg-[#0f0f16]">
                <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-white">{label}</p>
                  <p className="text-xs text-gray-600">{desc}</p>
                </div>
                <span className="ml-auto text-xs font-bold text-orange-400 shrink-0">{value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Active Recommendations</CardTitle>
            <Badge variant={insights.length > 0 ? 'fire' : 'muted'}>{insights.length}</Badge>
          </CardHeader>
          <div className="space-y-3">
            {insights.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                <p className="text-sm text-gray-600">All clear. No active recommendations.</p>
              </div>
            )}
            {insights.map(insight => {
              const iconMap = {
                recommendation: <Lightbulb className="w-5 h-5 text-yellow-400" />,
                alert:          <AlertTriangle className="w-5 h-5 text-orange-400" />,
                prediction:     <TrendingUp className="w-5 h-5 text-sky-400" />,
              };
              const impactColors = { high: 'border-orange-500/30 bg-orange-500/5', medium: 'border-yellow-500/20 bg-yellow-500/5', low: 'border-sky-500/20 bg-sky-500/5' };

              return (
                <div key={insight.id} className={cn('rounded-xl border p-4', impactColors[insight.impact])}>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">{iconMap[insight.type]}</div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{insight.title}</p>
                        <button onClick={() => dismissInsight(insight.id)} className="text-gray-600 hover:text-gray-400 shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">{insight.description}</p>
                      <div className="flex items-center gap-3 mt-3">
                        <Badge variant={{ high: 'fire', medium: 'gold', low: 'ocean' }[insight.impact] as any}>
                          {insight.impact} impact
                        </Badge>
                        <span className="text-xs text-gray-600">{(insight.confidence * 100).toFixed(0)}% confidence</span>
                        {insight.action && (
                          <Button size="sm" variant="outline" className="ml-auto text-xs py-1">
                            {insight.action.label} <ChevronRight className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Spending forecast */}
        <Card>
          <CardHeader>
            <CardTitle>Spending Forecast (6 months)</CardTitle>
            <Badge variant="muted">AI model</Badge>
          </CardHeader>
          <SpendingChart />
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
            <div className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded bg-[#ff6b2b] inline-block" />Actual</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded bg-[#f4a935]/40 inline-block" />Predicted</div>
          </div>
        </Card>

        {/* Policy engine status */}
        <Card>
          <CardHeader><CardTitle>Policy Engine</CardTitle></CardHeader>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Cashflow classification',   status: 'active',   detail: 'Pattern: stable recurring spend' },
              { label: 'Payment pressure detection', status: 'active',   detail: '$449 due within 7 days detected' },
              { label: 'Execution cost monitor',     status: 'active',   detail: 'Fees 3× baseline — batching recommended' },
              { label: 'Yield opportunity scanner',  status: 'active',   detail: 'Horizon Yield APY above 30d avg' },
              { label: 'Oracle freshness check',     status: 'active',   detail: 'All feeds < 3 slots old' },
              { label: 'Emergency circuit breaker',  status: 'standby',  detail: 'No anomalies detected' },
            ].map(({ label, status, detail }) => (
              <div key={label} className="flex items-center gap-3 py-2 border-b border-[#1a1a24] last:border-0">
                <div className={cn('w-2 h-2 rounded-full shrink-0', status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600')} />
                <div className="flex-1">
                  <span className="text-gray-300">{label}</span>
                  <p className="text-xs text-gray-600 mt-0.5">{detail}</p>
                </div>
                <Badge variant={status === 'active' ? 'success' : 'muted'} className="text-[10px]">{status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
