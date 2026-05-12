// ============================================================
// ACE Protocol — Activity Log
//
// In-memory event log. Every action appends a human-readable
// entry so judges can follow the system's decision trail.
// ============================================================

export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'deposit' | 'withdraw' | 'payment' | 'execution_decision' | 'policy' | 'yield' | 'reserve' | 'error';
  message: string;
  detail?: string;
  txSig?: string;
}

let _log: LogEntry[] = [
  {
    id: 'init-1',
    timestamp: Math.floor(Date.now() / 1000) - 3600,
    type: 'policy',
    message: 'ACE Engine initialized',
    detail: 'Policy engine active. Simulation mode. Reserve/yield/liquid buckets calculated.',
  },
  {
    id: 'init-2',
    timestamp: Math.floor(Date.now() / 1000) - 3540,
    type: 'reserve',
    message: '0.40 SOL reserved for upcoming payment in 3 days',
    detail: 'Crew Server Bill ($149.99) due. Reserve buffer locked.',
  },
  {
    id: 'init-3',
    timestamp: Math.floor(Date.now() / 1000) - 3000,
    type: 'execution_decision',
    message: 'Rebalance batched — fees 2.8× baseline',
    detail: 'Delayed rebalance 45min to reduce cost. Estimated saving: $0.0003.',
  },
  {
    id: 'init-4',
    timestamp: Math.floor(Date.now() / 1000) - 1800,
    type: 'yield',
    message: 'Yield harvested: $87.40',
    detail: 'Horizon Yield strategy. Auto-compounded into yield bucket.',
  },
];

let _listeners: Array<() => void> = [];

export function getLog(): LogEntry[] {
  return [..._log].sort((a, b) => b.timestamp - a.timestamp);
}

export function appendLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
  const full: LogEntry = {
    ...entry,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Math.floor(Date.now() / 1000),
  };
  _log = [full, ..._log].slice(0, 100); // keep last 100
  _listeners.forEach(fn => fn());
  return full;
}

export function subscribeLog(fn: () => void): () => void {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter(l => l !== fn);
  };
}
