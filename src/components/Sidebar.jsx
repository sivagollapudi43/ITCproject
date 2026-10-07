import React from 'react';

const NAV = [
  {
    section: 'Overview',
    items: [
      { id: 'home',   icon: '🏠', label: 'Home' },
      { id: 'theory', icon: '📚', label: 'Theory' },
      { id: 'system', icon: '🔗', label: 'System Model' },
      { id: 'math',   icon: '∑',  label: 'Math Model' },
    ],
  },
  {
    section: 'Simulation',
    items: [
      { id: 'simulation',  icon: '⚡', label: 'Simulation' },
      { id: 'performance', icon: '📊', label: 'Performance' },
      { id: 'validation',  icon: '✅', label: 'Validation Tests' },
    ],
  },
];

export default function Sidebar({ currentPage, onNavigate }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <h2>LDPC Simulation</h2>
        <p>ITC Project • EVEN Registration</p>
      </div>

      <div className="sidebar-nav">
        {NAV.map(group => (
          <div key={group.section}>
            <div className="nav-section-label">{group.section}</div>
            {group.items.map(item => (
              <div
                key={item.id}
                className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
          <div>Performance Analysis of</div>
          <div style={{ color: 'var(--accent-cyan)' }}>LDPC Channel Coding</div>
          <div>over Wired Channel</div>
        </div>
      </div>
    </nav>
  );
}
