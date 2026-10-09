'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CostPool, CurrencyCode, EstimateResults, ModelKey } from '@/engine/types';
import { MODEL_KEYS } from '@/engine/types';
import { moneyCompact, money } from '@/lib/format';

/** Short model names so seven categories fit on a chart axis. */
export const SHORT: Record<ModelKey, string> = { fixed: 'Fixed', acu: 'ACU', abu: 'ABU', subscription: 'Subscr.', agentops: 'AgentOps', gainshare: 'Gainshare', hybrid: 'Hybrid' };

export const POOL_META: Record<CostPool, { label: string; color: string }> = {
  consumption: { label: 'AI consumption', color: '#1b6b45' },
  platform: { label: 'Infrastructure & platform', color: '#6fae8b' },
  agentops: { label: 'AgentOps', color: '#3d444d' },
  service: { label: 'Human review & other', color: '#c7a252' },
};

const axis = { fontSize: 11, fill: '#5f6873' };
const tipStyle = { fontSize: 12, borderRadius: 8, border: '1px solid #e3e6ea', boxShadow: '0 4px 12px rgba(16,24,40,.08)' };

export function PoolDonut({ res }: { res: EstimateResults }) {
  const data = (Object.keys(POOL_META) as CostPool[]).map((p) => ({ name: POOL_META[p].label, value: res.operating.pools[p], color: POOL_META[p].color })).filter((d) => d.value > 0);
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="88%" paddingAngle={1.5} stroke="none" isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => money(Number(v), res.currency)} contentStyle={tipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CostLinesBar({ res }: { res: EstimateResults }) {
  const data = res.operating.lines.filter((l) => l.monthly > 0).sort((a, b) => b.monthly - a.monthly).map((l) => ({ name: l.label, value: l.monthly, color: POOL_META[l.pool].color }));
  return (
    <div style={{ height: Math.max(180, data.length * 30 + 20) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="#eef0f2" />
          <XAxis type="number" tick={axis} tickFormatter={(v) => moneyCompact(v, res.currency)} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={190} tick={axis} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => money(Number(v), res.currency)} contentStyle={tipStyle} cursor={{ fill: '#f7f8f9' }} />
          <Bar dataKey="value" name="Monthly cost" radius={[0, 4, 4, 0]} barSize={16}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ModelCompareChart({ res, highlight }: { res: EstimateResults; highlight?: ModelKey }) {
  const data = MODEL_KEYS.map((k) => {
    const m = res.models[k];
    return { name: SHORT[k], key: k, Revenue: m.mrr, 'Delivery cost': m.monthlyDeliveryCost, Margin: m.recurringMargin ?? 0 };
  });
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="#eef0f2" />
          <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} interval={0} />
          <YAxis yAxisId="l" tick={axis} tickFormatter={(v) => moneyCompact(v, res.currency)} axisLine={false} tickLine={false} width={70} />
          <YAxis yAxisId="r" orientation="right" tick={axis} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            contentStyle={tipStyle}
            cursor={{ fill: '#f7f8f9' }}
            formatter={(v, n) => (n === 'Margin' ? `${Number(v).toFixed(1)}%` : money(Number(v), res.currency))}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="l" dataKey="Revenue" name="Monthly revenue" radius={[4, 4, 0, 0]} barSize={22}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.key === highlight ? '#124d31' : '#1b6b45'} />
            ))}
          </Bar>
          <Bar yAxisId="l" dataKey="Delivery cost" name="Monthly delivery cost" fill="#b8c0c9" radius={[4, 4, 0, 0]} barSize={22} />
          <Line yAxisId="r" dataKey="Margin" name="Recurring margin" stroke="#c7a252" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProjectionChart({ res, modelKey }: { res: EstimateResults; modelKey: ModelKey }) {
  const m = res.models[modelKey];
  const data = m.projection.slice(0, 3).map((r) => ({ name: `Year ${r.year}`, Revenue: r.revenue, Cost: r.cost, 'Gross profit': r.grossProfit }));
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="#eef0f2" />
          <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} tickFormatter={(v) => moneyCompact(v, res.currency)} axisLine={false} tickLine={false} width={70} />
          <Tooltip formatter={(v) => money(Number(v), res.currency)} contentStyle={tipStyle} cursor={{ fill: '#f7f8f9' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Revenue" fill="#1b6b45" radius={[4, 4, 0, 0]} barSize={28} />
          <Bar dataKey="Cost" fill="#b8c0c9" radius={[4, 4, 0, 0]} barSize={28} />
          <Line dataKey="Gross profit" stroke="#c7a252" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ValueChart({ res }: { res: EstimateResults }) {
  const v = res.value;
  const data = [
    { name: 'Capacity value (not cash)', value: v.capacityValueMonthly, color: '#9bc9ae' },
    { name: 'Financial benefit', value: v.financialBenefitMonthly, color: '#1b6b45' },
    { name: '  of which validated', value: v.validatedBenefitMonthly, color: '#124d31' },
    { name: 'Monthly client charge', value: v.annualClientCharges / 12, color: '#3d444d' },
  ];
  return (
    <div className="h-52">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="#eef0f2" />
          <XAxis type="number" tick={axis} tickFormatter={(x) => moneyCompact(x, res.currency)} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={170} tick={axis} axisLine={false} tickLine={false} />
          <Tooltip formatter={(x) => money(Number(x), res.currency)} contentStyle={tipStyle} cursor={{ fill: '#f7f8f9' }} />
          <Bar dataKey="value" name="Per month" radius={[0, 4, 4, 0]} barSize={18}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ThreeYearModelsChart({ res }: { res: EstimateResults }) {
  const data = MODEL_KEYS.map((k) => ({ name: SHORT[k], 'Revenue (3 yr)': res.models[k].threeYear.revenue, 'Gross profit (3 yr)': res.models[k].threeYear.grossProfit }));
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="#eef0f2" />
          <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={axis} tickFormatter={(v) => moneyCompact(v, res.currency)} axisLine={false} tickLine={false} width={70} />
          <Tooltip formatter={(v) => money(Number(v), res.currency)} contentStyle={tipStyle} cursor={{ fill: '#f7f8f9' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Revenue (3 yr)" fill="#1b6b45" radius={[4, 4, 0, 0]} barSize={20} />
          <Bar dataKey="Gross profit (3 yr)" fill="#c7a252" radius={[4, 4, 0, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScenarioChart({ rows, currency }: { rows: { name: string; cost: number; price: number | null; gp: number }[]; currency: CurrencyCode }) {
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ left: 8, right: 8, top: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="#eef0f2" />
          <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} tickFormatter={(v) => moneyCompact(v, currency)} axisLine={false} tickLine={false} width={70} />
          <Tooltip formatter={(v) => money(Number(v), currency)} contentStyle={tipStyle} cursor={{ fill: '#f7f8f9' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="cost" name="Monthly delivery cost" fill="#b8c0c9" radius={[4, 4, 0, 0]} barSize={26} />
          <Bar dataKey="gp" name="Provider gross profit (locked prices)" fill="#1b6b45" radius={[4, 4, 0, 0]} barSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
