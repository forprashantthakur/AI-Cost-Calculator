'use client';

import type { EstimateInputs, EstimateResults, RateCard } from '@/engine/types';
import type { ReportKind } from './reports';

type DownloadsApi = { save: (r: { filename: string; data: Blob }) => Promise<{ status: string }> };
type ClaudeHost = { use?: (name: string) => Promise<unknown> };

let downloadsApi: Promise<DownloadsApi | null> | null = null;

/** The hosting viewer's download capability, when the app runs inside one. */
function hostDownloads(): Promise<DownloadsApi | null> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (!host?.use) return Promise.resolve(null);
  if (!downloadsApi) downloadsApi = host.use('downloads').then((d) => (d as DownloadsApi) ?? null).catch(() => null);
  return downloadsApi;
}

/** Save a generated file. Resolves false if the viewer declined or saving is unavailable. */
export async function downloadBlob(blob: Blob, filename: string): Promise<boolean> {
  const api = await hostDownloads();
  if (api) {
    try {
      await api.save({ filename, data: blob });
      return true;
    } catch {
      return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

const safe = (s: string) => (s || 'estimate').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');

export async function exportPdf(kind: ReportKind, est: EstimateInputs, res: EstimateResults, rc: RateCard) {
  const { buildPdf, pdfFileName } = await import('./pdf');
  const doc = buildPdf(kind, est, res, rc);
  return downloadBlob(doc.output('blob'), pdfFileName(kind, est));
}

export async function exportExcel(est: EstimateInputs, res: EstimateResults, rc: RateCard) {
  const { workbookBuffer } = await import('./xlsx');
  const buf = await workbookBuffer(est, res, rc, { cacheResults: true });
  return downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${safe(est.name)}_Pricing-Workbook.xlsx`);
}

export function exportJson(list: EstimateInputs[], name = 'estimates') {
  return downloadBlob(new Blob([JSON.stringify({ format: 'ai-agent-pricing-calculator', version: 1, exportedAt: new Date().toISOString(), estimates: list }, null, 2)], { type: 'application/json' }), `${safe(name)}.json`);
}
