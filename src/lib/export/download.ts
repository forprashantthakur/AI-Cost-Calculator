'use client';

import type { EstimateInputs, EstimateResults, RateCard } from '@/engine/types';
import type { ReportKind } from './reports';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const safe = (s: string) => (s || 'estimate').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');

export async function exportPdf(kind: ReportKind, est: EstimateInputs, res: EstimateResults, rc: RateCard) {
  const { buildPdf, pdfFileName } = await import('./pdf');
  const doc = buildPdf(kind, est, res, rc);
  downloadBlob(doc.output('blob'), pdfFileName(kind, est));
}

export async function exportExcel(est: EstimateInputs, res: EstimateResults, rc: RateCard) {
  const { workbookBuffer } = await import('./xlsx');
  const buf = await workbookBuffer(est, res, rc, { cacheResults: true });
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${safe(est.name)}_Pricing-Workbook.xlsx`);
}

export function exportJson(list: EstimateInputs[], name = 'estimates') {
  downloadBlob(new Blob([JSON.stringify({ format: 'ai-agent-pricing-calculator', version: 1, exportedAt: new Date().toISOString(), estimates: list }, null, 2)], { type: 'application/json' }), `${safe(name)}.json`);
}
