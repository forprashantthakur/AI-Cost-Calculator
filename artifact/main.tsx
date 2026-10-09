import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/app/globals.css';
import { Shell } from '../src/components/Shell';
import Home from '../src/app/page';
import EstimatePage from '../src/app/estimate/page';
import DashboardPage from '../src/app/dashboard/page';
import ComparePage from '../src/app/compare/page';
import SimulatorPage from '../src/app/simulator/page';
import LibraryPage from '../src/app/library/page';
import SettingsPage from '../src/app/settings/page';
import Methodology from '../src/app/methodology/page';
import { usePath } from './router';

const PAGES: Record<string, ComponentType> = {
  '/': Home,
  '/estimate/': EstimatePage,
  '/dashboard/': DashboardPage,
  '/compare/': ComparePage,
  '/simulator/': SimulatorPage,
  '/library/': LibraryPage,
  '/settings/': SettingsPage,
  '/methodology/': Methodology,
};

function App() {
  const path = usePath();
  const Page = PAGES[path] ?? Home;
  return (
    <Shell>
      <Page key={path} />
    </Shell>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
