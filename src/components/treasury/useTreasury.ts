'use client';

import { useState, useCallback } from 'react';
import type { TreasuryAnalysis, TagRequest } from '@/types';

export type TreasuryRange = '30d' | '90d' | '180d' | '1y' | 'all';

export const RANGE_OPTIONS: { value: TreasuryRange; label: string; short: string }[] = [
  { value: '30d',  label: 'Last 30 Days',        short: '30D'  },
  { value: '90d',  label: 'Last 90 Days',         short: '90D'  },
  { value: '180d', label: 'Last 180 Days',        short: '180D' },
  { value: '1y',   label: 'Last 1 Year',          short: '1Y'   },
  { value: 'all',  label: 'All Available History', short: 'ALL'  },
];

export function useTreasury(sessionToken: string | null, initialRange: TreasuryRange = '30d') {
  const [analysis, setAnalysis] = useState<TreasuryAnalysis | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingestResult, setIngestResult] = useState<{
    ingested?: number;
    meaningful?: number;
    filtered?: number;
    cached?: boolean;
    message?: string;
    range?: string;
  } | null>(null);
  const [range, setRange] = useState<TreasuryRange>(initialRange);

  const authFetch = useCallback(async <T>(url: string, options?: RequestInit): Promise<T> => {
    if (!sessionToken) throw new Error('No session token');
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
        ...(options?.headers ?? {}),
      },
    });
    const body = await res.json() as T & { error?: string };
    if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Request failed');
    return body;
  }, [sessionToken]);

  const ingest = useCallback(async (r?: TreasuryRange) => {
    const activeRange = r ?? range;
    setIsIngesting(true);
    setError(null);
    try {
      const result = await authFetch<{
        ok: boolean;
        ingested?: number;
        meaningful?: number;
        filtered?: number;
        cached?: boolean;
        message?: string;
        range?: string;
        error?: string;
      }>('/api/treasury/ingest', {
        method: 'POST',
        body: JSON.stringify({ range: activeRange }),
      });
      setIngestResult(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ingestion failed';
      setError(msg);
      return null;
    } finally {
      setIsIngesting(false);
    }
  }, [authFetch, range]);

  const analyze = useCallback(async (r?: TreasuryRange) => {
    const activeRange = r ?? range;
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await authFetch<TreasuryAnalysis>(`/api/treasury/analysis?range=${activeRange}`);
      setAnalysis(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setError(msg);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [authFetch, range]);

  const generateInsights = useCallback(async (r?: TreasuryRange) => {
    const activeRange = r ?? range;
    setIsGeneratingInsights(true);
    setError(null);
    try {
      const result = await authFetch<{ insights: TreasuryAnalysis['insights'] }>(
        `/api/treasury/insights?range=${activeRange}`,
        { method: 'POST' },
      );
      if (analysis) {
        setAnalysis(prev => prev ? { ...prev, insights: result.insights } : prev);
      }
      return result.insights;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Insight generation failed';
      setError(msg);
      return null;
    } finally {
      setIsGeneratingInsights(false);
    }
  }, [authFetch, analysis, range]);

  const submitTag = useCallback(async (req: TagRequest) => {
    try {
      await authFetch('/api/treasury/tags', {
        method: 'POST',
        body: JSON.stringify(req),
      });
      // Re-analyze to reflect updated tags (keep current range)
      await analyze();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Tag submission failed';
      setError(msg);
    }
  }, [authFetch, analyze]);

  const runFullAnalysis = useCallback(async (r?: TreasuryRange) => {
    const activeRange = r ?? range;
    const ingestRes = await ingest(activeRange);
    if (ingestRes && !('error' in ingestRes && ingestRes.error)) {
      await analyze(activeRange);
    }
  }, [ingest, analyze, range]);

  const changeRange = useCallback(async (newRange: TreasuryRange) => {
    setRange(newRange);
    await runFullAnalysis(newRange);
  }, [runFullAnalysis]);

  return {
    analysis,
    isIngesting,
    isAnalyzing,
    isGeneratingInsights,
    error,
    ingestResult,
    range,
    setRange,
    changeRange,
    ingest,
    analyze,
    generateInsights,
    submitTag,
    runFullAnalysis,
  };
}
