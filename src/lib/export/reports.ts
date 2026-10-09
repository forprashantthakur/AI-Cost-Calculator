export type ReportKind = 'estimate' | 'cost' | 'compare' | 'roi' | 'projection';

export const REPORTS: { kind: ReportKind; title: string; description: string }[] = [
  { kind: 'estimate', title: 'Pricing Estimate', description: 'Executive summary: costs, unit prices, recommended model, margin and ROI.' },
  { kind: 'cost', title: 'ACU / ABU Cost Breakdown', description: 'Every cost line with its driver and rate, AgentOps, ACU metering and ABU unit economics.' },
  { kind: 'compare', title: 'Commercial Model Comparison', description: 'All seven models side by side with the cost-recovery matrix and recommendation.' },
  { kind: 'roi', title: 'Client ROI Report', description: 'Productivity, financial benefits (assumed vs validated), ROI, payback and SDLC metrics.' },
  { kind: 'projection', title: 'Three-Year Financial Projection', description: 'Revenue, cost, gross profit and margin by year for every commercial model.' },
];
