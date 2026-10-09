import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Shell } from '@/components/Shell';

export const metadata: Metadata = {
  title: 'Enterprise AI Agent Pricing & Value Calculator',
  description: 'From AI Agent Consumption to Business Outcomes and Commercial Value. Price AI agents with ACU/ABU economics, seven commercial models, scenario analysis and client ROI.',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1b6b45' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
