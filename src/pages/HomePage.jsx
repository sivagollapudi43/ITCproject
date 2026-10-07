import React from 'react';

export default function HomePage({ onNavigate }) {
  return (
    <div>
      {/* Hero */}
      <div className="hero-band">
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
            Information Theory and Coding • Academic Project
          </div>
          <h1>
            Performance Analysis of<br />
            <span className="gradient-text">LDPC Channel Coding</span><br />
            <span style={{ color: 'var(--text-secondary)', fontSize: '1.6rem', fontWeight: 600 }}>
              over a Wired Communication Channel
            </span>
          </h1>
          <p>
            A complete interactive simulation demonstrating LDPC encoding, lossless wired channel transmission,
            controlled-noise Binary Symmetric Channel experiments, Belief Propagation decoding, and BER performance analysis.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg" onClick={() => onNavigate('simulation')}>
              🚀 Launch Simulation
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => onNavigate('theory')}>
              📚 Read Theory
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => onNavigate('performance')}>
              📊 Performance Analysis
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Project Info */}
        <div className="banner banner-info" style={{ marginBottom: 32 }}>
          <span className="banner-icon">ℹ️</span>
          <div>
            <strong>Assignment Context:</strong> Registration number is EVEN → Wired Channel is used.
            Baseline: Lossless Wired Channel (y = c, BER = 0).
            Performance Experiment: Binary Symmetric Channel (BSC) with controlled bit-flip probability p.
            Channel coding: LDPC with Belief Propagation decoder (NOT Hamming, NOT CRC).
          </div>
        </div>

        {/* Pipeline overview */}
        <div className="section-title">
          System Pipeline <span className="tag">Block Diagram</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 40px' }}>
          <PipelineView />
        </div>

        <hr className="section-divider" />

        {/* Feature cards */}
        <div className="section-title">Key Features</div>
        <div className="grid-3" style={{ marginBottom: 40 }}>
          {FEATURES.map(f => (
            <div className="card" key={f.title} style={{ cursor: 'pointer' }} onClick={() => onNavigate(f.page)}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</div>
              <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--accent-blue)' }}>→ {f.label}</div>
            </div>
          ))}
        </div>

        {/* Technical specs */}
        <div className="section-title">Technical Specifications</div>
        <div className="grid-2">
          <div className="card">
            <div className="card-title">Channel Coding</div>
            <table style={{ width: '100%' }}>
              <tbody>
                {[
                  ['Code Type', 'LDPC (Low-Density Parity-Check)'],
                  ['Default Code Rate R', '1/2'],
                  ['Default K (info bits)', '10,000'],
                  ['Encoder', 'Systematic LDPC via GF(2) row reduction'],
                  ['Decoder', 'Belief Propagation (Min-Sum variant)'],
                  ['H matrix', 'Gallager-style sparse parity-check'],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: '0.82rem' }}>{k}</td>
                    <td style={{ color: 'var(--accent-cyan)', textAlign: 'right' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <div className="card-title">Channel Models</div>
            <table style={{ width: '100%' }}>
              <tbody>
                {[
                  ['Primary Channel', 'Lossless Wired (y = c)'],
                  ['Noise Model', 'Binary Symmetric Channel (BSC)'],
                  ['BSC Transition', 'P(Y≠X) = p, P(Y=X) = 1-p'],
                  ['Noise Range p', '0 … 0.10'],
                  ['Lossless BER', '= 0 (exact)'],
                  ['Framework', 'React + Vite, Pure JS simulation'],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: '0.82rem' }}>{k}</td>
                    <td style={{ color: 'var(--accent-cyan)', textAlign: 'right' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: '🔬', title: 'LDPC Encoder', desc: 'Real systematic LDPC encoding using GF(2) row reduction to derive the generator matrix G. Parity check Hc^T = 0 verified.', page: 'simulation', label: 'Run Simulation' },
  { icon: '📡', title: 'Channel Models', desc: 'Lossless wired channel (y=c, BER=0) as baseline. Binary Symmetric Channel (BSC) for controlled noise experiments.', page: 'system', label: 'View System Model' },
  { icon: '🔄', title: 'BP Decoder', desc: 'Belief Propagation (Min-Sum variant) decoder on Tanner graph. Iterative syndrome-based decoding with convergence detection.', page: 'simulation', label: 'Run Simulation' },
  { icon: '📈', title: 'BER Analysis', desc: 'Dynamic BER calculation: raw channel BER vs post-LDPC BER across all noise levels. Log-scale graphs with data tables.', page: 'performance', label: 'View Performance' },
  { icon: '📐', title: 'Math Model', desc: 'Complete mathematical formulation: source, H matrix, encoding, channel models, syndrome equations, and BER formula.', page: 'math', label: 'View Math' },
  { icon: '✅', title: 'Validation Suite', desc: '7 automatic tests verifying: Hc^T=0, y=c, syndrome, recovery, lossless BER=0, BSC BER≈p, and LDPC improvement.', page: 'validation', label: 'Run Tests' },
];

function PipelineView() {
  const BLOCKS = [
    { label: 'Saturated Source', sub: 'u ∈ GF(2)^K', color: 'var(--accent-violet)' },
    { label: 'LDPC Encoder',    sub: 'c = uG mod 2', color: 'var(--accent-blue)' },
    { label: 'Wired Channel',   sub: 'Lossless y=c | BSC y=c⊕z', color: 'var(--accent-cyan)' },
    { label: 'Channel Noise',   sub: 'z ~ Bernoulli(p)', color: 'var(--accent-amber)' },
    { label: 'LDPC Decoder',    sub: 'Belief Propagation', color: 'var(--accent-emerald)' },
    { label: 'Recovered Data',  sub: 'û = first K bits', color: 'var(--accent-blue)' },
    { label: 'BER Calculation', sub: 'BER = errors / total', color: 'var(--accent-rose)' },
  ];
  return (
    <div className="pipeline">
      {BLOCKS.map((b, i) => (
        <React.Fragment key={b.label}>
          <div className="pipeline-block" style={{ borderColor: b.color + '66' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: b.color, margin: '0 auto 8px' }} />
            <div className="pipeline-block-title" style={{ color: b.color }}>{b.label}</div>
            <div className="pipeline-block-value">{b.sub}</div>
          </div>
          {i < BLOCKS.length - 1 && <div className="pipeline-arrow" />}
        </React.Fragment>
      ))}
    </div>
  );
}
