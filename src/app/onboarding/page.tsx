'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Anchor, Flame, Shield, TrendingUp, Zap, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import type { RiskLevel } from '@/types';

const STEPS = ['welcome', 'goal', 'risk', 'allocation', 'launch'] as const;
type Step = typeof STEPS[number];

export default function OnboardingPage() {
  const router = useRouter();
  const { completeOnboarding } = useApp();
  const [step, setStep] = useState<Step>('welcome');
  const [monthlySpend, setMonthlySpend] = useState(500);
  const [risk, setRisk] = useState<RiskLevel>('balanced');
  const [automate, setAutomate] = useState(true);

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex) / (STEPS.length - 1)) * 100;

  function next() {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
    else {
      completeOnboarding();
      router.push('/dashboard');
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] grid-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ff6b2b] to-[#f4a935] flex items-center justify-center fire-glow">
            <Anchor className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">ACE Protocol</h1>
            <p className="text-xs text-gray-600">Adaptive Cashflow Engine</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className={cn(
              'h-1 flex-1 rounded-full transition-all duration-500',
              i <= stepIndex ? 'bg-gradient-to-r from-[#ff6b2b] to-[#f4a935]' : 'bg-[#2a2a3a]',
            )} />
          ))}
        </div>

        {/* Step: Welcome */}
        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-white mb-3">Begin your voyage.</h2>
              <p className="text-gray-400 leading-relaxed">
                ACE Protocol turns your capital into automated cashflow. Set your goal, define your crew, and let the engine do the work.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-left">
              {[
                { icon: TrendingUp, label: 'Earn yield',     desc: 'Put idle capital to work' },
                { icon: Shield,     label: 'Stay protected', desc: 'Reserve buffer enforced' },
                { icon: Zap,        label: 'Auto-pay',       desc: 'Bills handled on-chain' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="rounded-xl border border-[#2a2a3a] bg-[#13131a] p-4">
                  <Icon className="w-5 h-5 text-orange-400 mb-2" />
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
            <Button size="lg" fullWidth onClick={next}>
              Set Sail <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step: Goal */}
        {step === 'goal' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">What's your monthly spend?</h2>
              <p className="text-gray-500 text-sm">We'll size your liquid reserve and payment buffers automatically.</p>
            </div>
            <div className="rounded-xl border border-[#2a2a3a] bg-[#13131a] p-6 text-center">
              <p className="text-5xl font-bold gradient-fire">${monthlySpend.toLocaleString()}</p>
              <p className="text-gray-500 text-sm mt-1">per month</p>
              <input
                type="range" min={100} max={5000} step={50}
                value={monthlySpend}
                onChange={e => setMonthlySpend(Number(e.target.value))}
                className="w-full mt-4 accent-orange-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>$100</span><span>$5,000</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl border border-[#2a2a3a] bg-[#13131a]">
              <div>
                <p className="text-sm text-white font-medium">Automate recurring payments?</p>
                <p className="text-xs text-gray-600 mt-0.5">Let ACE handle bill payments automatically</p>
              </div>
              <button onClick={() => setAutomate(!automate)}
                className={cn('w-12 h-6 rounded-full transition-all relative', automate ? 'bg-orange-500' : 'bg-[#2a2a3a]')}>
                <span className={cn('absolute top-1 w-4 h-4 rounded-full bg-white transition-all', automate ? 'left-7' : 'left-1')} />
              </button>
            </div>
            <Button size="lg" fullWidth onClick={next}>
              Continue <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step: Risk */}
        {step === 'risk' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Choose your risk profile.</h2>
              <p className="text-gray-500 text-sm">This determines how aggressively ACE seeks yield vs. protecting capital.</p>
            </div>
            <div className="space-y-3">
              {([
                { id: 'conservative', label: 'Harbor Safe',   desc: 'Lower yield, maximum stability. Mostly liquid staking + T-bills.', apy: '5–7%' },
                { id: 'balanced',     label: 'Steady Voyage', desc: 'Balanced yield and risk. Mix of DeFi strategies.', apy: '8–12%' },
                { id: 'aggressive',   label: 'Full Sail',     desc: 'Higher yield, higher volatility. Active DeFi positions.', apy: '12–20%' },
              ] as Array<{ id: RiskLevel; label: string; desc: string; apy: string }>).map(opt => (
                <button key={opt.id} onClick={() => setRisk(opt.id)}
                  className={cn(
                    'w-full text-left p-4 rounded-xl border transition-all',
                    risk === opt.id
                      ? 'border-orange-500/50 bg-orange-500/10'
                      : 'border-[#2a2a3a] bg-[#13131a] hover:border-[#3a3a4a]',
                  )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{opt.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-bold text-emerald-400">{opt.apy}</p>
                      <p className="text-[10px] text-gray-600">Target APY</p>
                    </div>
                  </div>
                  {risk === opt.id && <div className="absolute top-3 right-3"><Check className="w-4 h-4 text-orange-400" /></div>}
                </button>
              ))}
            </div>
            <Button size="lg" fullWidth onClick={next}>
              Continue <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step: Allocation */}
        {step === 'allocation' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Your recommended allocation.</h2>
              <p className="text-gray-500 text-sm">ACE will auto-rebalance to maintain this split. You can change it anytime.</p>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Earning yield',  pct: risk === 'conservative' ? 50 : risk === 'balanced' ? 60 : 75, color: 'bg-emerald-500' },
                { label: 'Harbor reserve', pct: risk === 'conservative' ? 35 : risk === 'balanced' ? 20 : 10, color: 'bg-sky-500' },
                { label: 'Liquid (spend)', pct: risk === 'conservative' ? 10 : risk === 'balanced' ? 15 : 12, color: 'bg-orange-500' },
                { label: 'Payments lock',  pct: risk === 'conservative' ? 5  : risk === 'balanced' ? 5  : 3,  color: 'bg-yellow-500' },
              ].map(({ label, pct, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={cn('w-2 h-2 rounded-full shrink-0', color)} />
                  <span className="flex-1 text-sm text-gray-400">{label}</span>
                  <div className="flex-1 h-2 rounded-full bg-[#2a2a3a] overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-sm font-bold text-white">{pct}%</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 text-center">
              Guardrail: reserve will never drop below 10% regardless of market conditions.
            </p>
            <Button size="lg" fullWidth onClick={next}>
              Looks good <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step: Launch */}
        {step === 'launch' && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#ff6b2b] to-[#f4a935] flex items-center justify-center mx-auto fire-glow">
              <Flame className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white mb-3">All hands on deck.</h2>
              <p className="text-gray-400 leading-relaxed">
                Your ACE vault is configured. Deposit USDC to activate your cashflow engine and let the voyage begin.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-left space-y-2">
              {[
                'Vault initialized on Solana devnet',
                'Allocation policy saved',
                'Auto-rebalance enabled',
                automate ? 'Payment automation ready' : 'Manual payment mode selected',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-400">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
            <Button size="lg" fullWidth onClick={next}>
              <Anchor className="w-4 h-4" />
              Open the Bridge
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
