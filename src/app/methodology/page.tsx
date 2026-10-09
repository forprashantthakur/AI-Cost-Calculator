'use client';

import { useStore } from '@/store/store';
import { Card, PageHeader } from '@/components/ui';

const F = ({ children }: { children: React.ReactNode }) => <code className="block rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[12.5px] leading-relaxed text-ink">{children}</code>;

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card>
    <h2 className="mb-3 text-[15px] font-semibold">{title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-ink-2">{children}</div>
  </Card>
);

export default function Methodology() {
  const rc = useStore((s) => s.rateCard);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader eyebrow="Methodology" title="Calculation methodology and formulas" sub="Every figure comes from one deterministic, decimal-safe engine (34 significant digits). The dashboard, simulator, PDF reports and Excel workbook read the same results." />

      <Section title="1. Volume funnel — no transaction is counted twice">
        <F>
          Unique = Submitted × (1 − duplicate rate)
          <br />
          Executions = Submitted × (1 + retry rate)
          <br />
          Accepted = Unique × success rate
          <br />
          Weighted ABUs = Accepted × Σ(complexity share × ABU weight)
        </F>
        <p>Retries, failed attempts and duplicates consume resources (they are inside the cost) but never create an extra ABU. Default ABU weights: Low {rc.abuWeights.low}, Medium {rc.abuWeights.medium}, High {rc.abuWeights.high}.</p>
      </Section>

      <Section title="2. Monthly operating cost">
        <F>
          Input tokens = Executions × calls × input tokens per call × effort
          <br />
          LLM cost = uncached input × input rate + cached input × cached rate + output × output rate
          <br />
          OCR = Submitted × pages × effort × rate (once per document — retries reuse text)
          <br />
          Total = AI consumption + infrastructure & platform + AgentOps + human review & other
        </F>
        <p>Cached input tokens are billed once, at the cached rate, and never also at the full input rate. Monitoring tooling sits in platform cost; monitoring staff effort sits in AgentOps — so neither is counted twice. Vendor rates are in USD and converted at the rate-card FX rate; provider labour (implementation, AgentOps) is scaled by the delivery cost index of the estimate currency.</p>
      </Section>

      <Section title="3. Implementation">
        <F>
          Detailed: delivery cost = Σ hours × role rate × FX × delivery index
          <br />
          Implementation price = delivery cost ÷ (1 − implementation margin)
        </F>
        <p>Implementation is a one-time figure and never enters monthly run cost or unit prices.</p>
      </Section>

      <Section title="4. ACU — AI Consumption Unit">
        <F>
          Method A (cost-normalised): ACUs = eligible AI consumption cost ÷ reference cost per ACU ({rc.acu.referenceCost} {rc.acu.referenceCurrency})
          <br />
          Method B (weighted resources): ACUs = Σ measured quantity × ACU conversion factor
          <br />
          ACU price = recoverable cost ÷ ACUs ÷ (1 − target margin)
        </F>
        <p>The ACU is a commercial abstraction defined by this calculator ({rc.acu.version}); one token is not one ACU. Conversion factors are editable and versioned in Settings.</p>
      </Section>

      <Section title="5. ABU — AI Business Unit">
        <F>
          Cost per ABU = total attributable delivery cost ÷ accepted weighted ABUs
          <br />
          ABU price = cost recovered by the ABU price ÷ ABUs ÷ (1 − target margin)
        </F>
        <p>The cost of unsuccessful attempts and retries is carried by accepted outcomes. If AgentOps is billed as a separate fee, its cost is excluded from the ABU (and ACU) price.</p>
      </Section>

      <Section title="6. Commercial models and duplicate-recovery prevention">
        <p>Costs fall into four pools — AI consumption, platform, AgentOps, human review & other. Every commercial model assigns each pool to exactly one revenue component (or to the client as pass-through, or at risk under gainshare). The engine checks this for every model on every calculation.</p>
        <F>
          Fixed: fixed fee = total ÷ (1 − m) · ACU / ABU: units × price (+ AgentOps fee if separate)
          <br />
          Subscription: fee × units + overage above the included ABUs · Managed AgentOps: AgentOps ÷ (1 − m), rest pass-through
          <br />
          Gainshare: % × financial benefits · Hybrid: subscription (platform) + usage (consumption, review) + AgentOps fee + optional gainshare
        </F>
        <p>Prices are set once at baseline volume. Years 2–3 apply volume growth to costs and usage, and annual escalation to prices. Graduated volume discounts and minimum monthly commitments apply to usage-based charges.</p>
      </Section>

      <Section title="7. Client value and ROI">
        <F>
          Hours saved = manual hours − (accepted × AI-assisted minutes + not-accepted × manual minutes) ÷ 60
          <br />
          Financial benefit = capacity value × cash realisation + cost avoidance + attributable revenue margin
          <br />
          ROI = (financial benefits − total AI investment) ÷ total AI investment × 100
          <br />
          Payback = implementation price ÷ (monthly benefit − monthly client charge)
        </F>
        <p>Productivity value is not cash. Each benefit is marked as an assumption or a validated actual, and ROI is shown both with and without assumed benefits. SDLC improvements are claimed only where a measured or clearly assumed baseline exists; story points, suggestions and lines of code are never billable ABUs.</p>
      </Section>

      <Section title="8. Reconciliation">
        <p>Each result carries reconciliation checks: cost lines and pools equal the total; LLM components equal the LLM total; accepted ≤ unique ≤ submitted; ACUs × reference cost = eligible cost; each model&apos;s components equal its monthly revenue; annual revenue = implementation + 12 × MRR; every pool is recovered exactly once. The Excel export rebuilds the numbers with live formulas and includes a Reconciliation sheet comparing each formula with the calculator value.</p>
      </Section>
    </div>
  );
}
