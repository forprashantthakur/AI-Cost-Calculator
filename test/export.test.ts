import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import { computeEstimate } from '@/engine';
import { buildSamples } from '@/data/samples';
import { buildWorkbook } from '@/lib/export/xlsx';
import { RC, simpleEstimate } from './fixtures';

const hasSoffice = (() => {
  try {
    execFileSync('soffice', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const hasPdftotext = (() => {
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const cellValue = (c: ExcelJS.Cell) => {
  const v = c.value as unknown;
  if (v && typeof v === 'object' && 'result' in (v as object)) return (v as { result: unknown }).result;
  return v;
};

describe('Excel pricing workbook', () => {
  test('builds with named inputs, live formulas and a reconciliation sheet', async () => {
    const est = buildSamples(RC)[0];
    const wb = buildWorkbook(est, computeEstimate(est, RC), RC);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['README', 'Inputs', 'Rates', 'Costs', 'Pricing', 'Projection', 'Commercial', 'ROI', 'Reconciliation']);
    const names = (wb.definedNames as unknown as { model: { name: string }[] }).model.map((n) => n.name);
    for (const n of ['Volume', 'SuccessRate', 'TotalCost', 'AbuPrice', 'AcuPrice', 'ImplPrice', 'RoiThreeYear']) expect(names).toContain(n);
    const buf = await wb.xlsx.writeBuffer();
    expect(buf.byteLength).toBeGreaterThan(10000);
  });

  test.skipIf(!hasSoffice)(
    'LibreOffice recalculation of every sample workbook reconciles with the engine',
    async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pricing-xlsx-'));
      const out = path.join(dir, 'out');
      const estimates = [...buildSamples(RC), simpleEstimate({ monthlyVolume: 0 }), simpleEstimate({ commercial: { agentOpsBilling: 'separate', minMonthlyCommitment: 5000, volumeTiers: [{ upTo: 500, discountPct: 0 }, { upTo: 1000, discountPct: 7.5 }] } as never }) ];
      const files: string[] = [];
      for (const [i, est] of estimates.entries()) {
        const res = computeEstimate(est, RC);
        // No cached results: LibreOffice must compute every formula itself.
        const wb = buildWorkbook(est, res, RC, { cacheResults: false });
        const file = path.join(dir, `est-${i}.xlsx`);
        await wb.xlsx.writeFile(file);
        files.push(file);
      }
      execFileSync('soffice', ['--headless', '--calc', '--convert-to', 'xlsx', '--outdir', out, ...files], { stdio: 'ignore', timeout: 180000 });
      for (const [i, est] of estimates.entries()) {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(path.join(out, `est-${i}.xlsx`));
        const ws = wb.getWorksheet('Reconciliation')!;
        const bad: string[] = [];
        let checked = 0;
        ws.eachRow((row, r) => {
          if (r < 5) return;
          const status = cellValue(row.getCell(5));
          if (status === 'Reconciled' || status === 'Changed') {
            checked++;
            if (status !== 'Reconciled') bad.push(`${row.getCell(1).value}: workbook ${cellValue(row.getCell(2))} vs engine ${cellValue(row.getCell(3))}`);
          }
        });
        expect(checked, est.name).toBeGreaterThan(50);
        expect(bad, est.name).toEqual([]);
      }
      fs.rmSync(dir, { recursive: true, force: true });
    },
    240000,
  );
});

describe('PDF reports', () => {
  test('every report type renders for every sample', async () => {
    const { buildPdf, REPORTS } = await import('@/lib/export/pdf');
    for (const est of buildSamples(RC)) {
      const res = computeEstimate(est, RC);
      for (const r of REPORTS) {
        const doc = buildPdf(r.kind, est, res, RC);
        const bytes = doc.output('arraybuffer');
        expect(bytes.byteLength, `${est.name} / ${r.title}`).toBeGreaterThan(3000);
        expect(doc.getNumberOfPages()).toBeGreaterThan(0);
      }
    }
  });

  test.skipIf(!hasPdftotext)('PDF headline figures match the dashboard numbers', async () => {
    const { buildPdf } = await import('@/lib/export/pdf');
    const est = buildSamples(RC)[3]; // USD sample
    const res = computeEstimate(est, RC);
    const doc = buildPdf('estimate', est, res, RC);
    const p = path.join(os.tmpdir(), `pricing-estimate-${Date.now()}.pdf`);
    fs.writeFileSync(p, Buffer.from(doc.output('arraybuffer')));
    const text = execFileSync('pdftotext', ['-layout', p, '-']).toString();
    const usd = (v: number) => `$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;
    expect(text).toContain(usd(res.implementation.price));
    expect(text).toContain(usd(res.operating.total));
    expect(text).toContain(usd(res.selected.mrr));
    expect(text).toContain('ASSUMPTIONS');
    expect(text).toContain('ESTIMATES');
    fs.rmSync(p);
  });
});
