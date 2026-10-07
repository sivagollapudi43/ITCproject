import React, { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import TheoryPage from './pages/TheoryPage';
import SystemModelPage from './pages/SystemModelPage';
import MathModelPage from './pages/MathModelPage';
import SimulationPage from './pages/SimulationPage';
import PerformancePage from './pages/PerformancePage';
import ValidationPage from './pages/ValidationPage';
import './index.css';

const PAGES = {
  home: HomePage,
  theory: TheoryPage,
  system: SystemModelPage,
  math: MathModelPage,
  simulation: SimulationPage,
  performance: PerformancePage,
  validation: ValidationPage,
};

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  // Shared simulation state – passed down to pages that need it
  const [sharedState, setSharedState] = useState(null);

  const Page = PAGES[currentPage] || HomePage;

  return (
    <div className="app-wrapper">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="main-content">
        <Page
          onNavigate={setCurrentPage}
          sharedState={sharedState}
          setSharedState={setSharedState}
        />
      </main>
    </div>
  );
}
