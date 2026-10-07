import React, { useState, useMemo } from 'react';
import { generateLDPCMatrix, matrixStats } from '../core/ldpc';

const NOISE_LEVELS = [0, 0.001, 0.005, 0.01, 0.02, 0.05, 0.10];

export default function SystemModelPage() {
  const [K, setK] = useState(200);
  const [rate, setRate] = useState(0.5);
  const [matData, setMatData] = useState(null);
  const [generating, setGenerating] = useState(false);

  function generate() {
    setGenerating(true);
    setTimeout(() => {
      const data = generateLDPCMatrix(K, rate);
      setMatData(data);
      setGenerating(false);
    }, 50);
  }

  const stats = matData ? matrixStats(matData.H, matData.M, matData.N) : null;

  return (
    <div>
      <div className="page-header">
        <h1>🔗 System Model</h1>
        <p>Block diagram, channel models, parity-check matrix visualization, and system parameters</p>
      </div>
      <div className="page-body">

        {/* System Block Diagram */}
        <div className="section-title">System Block Diagram</div>
        <BlockDiagram />

        <hr className="section-divider" />

        {/* Channel Models */}
        <div className="section-title">Channel Models <span className="tag">Formal Definition</span></div>
        <div className="grid-2">
          {/* Lossless */}
          <div className="card" style={{ borderColor: 'rgba(16,185,129,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="card-title" style={{ margin: 0 }}>Lossless Wired Channel</div>
              <span className="channel-badge lossless">✓ BASELINE</span>
            </div>
            <div className="math-block">y = c</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '12px 0' }}>
              No bit errors. Every received bit equals the transmitted bit.
              Required by assignment (EVEN registration → wired channel).
            </p>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>Transition Matrix:</div>
            <TransitionMatrix p={0} />
            <div style={{ marginTop: 16 }}>
              {[
                ['Channel Errors', '0'],
                ['Raw BER', '0.0000'],
                ['LDPC BER', '0.0000'],
                ['Syndrome Hy^T', '= 0'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* BSC */}
          <div className="card" style={{ borderColor: 'rgba(245,158,11,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="card-title" style={{ margin: 0 }}>Binary Symmetric Channel (BSC)</div>
              <span className="channel-badge bsc">NOISE EXPERIMENT</span>
            </div>
            <div className="math-block">y_i = c_i ⊕ z_i,  z_i ~ Bernoulli(p)</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '12px 0' }}>
              Each bit independently flipped with probability p. Used for controlled-noise performance analysis.
            </p>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>Transition Matrix (p = 0.01):</div>
            <TransitionMatrix p={0.01} />
            <div style={{ marginTop: 16 }}>
              {[
                ['P(Y=0|X=0)', '1-p'],
                ['P(Y=1|X=0)', 'p  (error)'],
                ['P(Y=0|X=1)', 'p  (error)'],
                ['P(Y=1|X=1)', '1-p'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <hr className="section-divider" />

        {/* H Matrix visualization */}
        <div className="section-title">LDPC Parity-Check Matrix H <span className="tag">Visualization</span></div>
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="form-group">
              <label className="form-label">K (info bits for visualization)</label>
              <select className="form-control" value={K} onChange={e => setK(+e.target.value)}>
                {[50, 100, 200, 300, 400].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Code Rate R</label>
              <select className="form-control" value={rate} onChange={e => setRate(+e.target.value)}>
                <option value={0.5}>1/2</option>
                <option value={0.33}>1/3</option>
                <option value={0.67}>2/3</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={generate} disabled={generating}>
              {generating ? <><span className="loader" /> Generating…</> : '⚙️ Generate H Matrix'}
            </button>
          </div>

          {matData && stats && (
            <div className="fade-in">
              <div className="grid-4" style={{ marginTop: 20, marginBottom: 20 }}>
                <StatCard label="Rows M" value={stats.rows} color="accent-blue" />
                <StatCard label="Columns N" value={stats.cols} color="accent-cyan" />
                <StatCard label="Non-zero Elements" value={stats.nonzero} color="accent-violet" />
                <StatCard label="Density" value={(stats.density * 100).toFixed(2) + '%'} color="accent-amber" />
              </div>

              <div style={{ marginBottom: 12, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Matrix H ({stats.rows} × {stats.cols}) — Blue = 1, Dark = 0
                {stats.cols > 200 && ' (showing first 200 columns)'}
              </div>
              <HeatMap H={matData.H} M={stats.rows} N={stats.cols} />
            </div>
          )}
          {!matData && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Click "Generate H Matrix" to visualize the LDPC parity-check matrix
            </div>
          )}
        </div>

        <hr className="section-divider" />

        {/* BSC expected BER table */}
        <div className="section-title">Expected Raw BER vs Noise Probability</div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Channel Mode</th>
                <th>Noise Prob p</th>
                <th>Expected Raw BER</th>
                <th>LDPC Expected Behavior</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="badge badge-pass">Lossless</span></td>
                <td>0 (no noise)</td>
                <td style={{ color: 'var(--accent-emerald)' }}>0.0000</td>
                <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>No errors to correct, BER = 0</td>
              </tr>
              {NOISE_LEVELS.filter(p => p > 0).map(p => (
                <tr key={p}>
                  <td><span className="badge badge-warn">BSC</span></td>
                  <td>{p}</td>
                  <td style={{ color: 'var(--accent-amber)' }}>≈ {p}</td>
                  <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                    {p <= 0.05 ? 'LDPC should reduce BER significantly' : 'LDPC may fail at high noise'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${color}`}>{value}</div>
    </div>
  );
}

function TransitionMatrix({ p }) {
  const vals = [
    ['', 'X=0', 'X=1'],
    ['Y=0', (1-p).toFixed(4), p.toFixed(4)],
    ['Y=1', p.toFixed(4), (1-p).toFixed(4)],
  ];
  return (
    <div className="transition-matrix">
      {vals.map((row, ri) => row.map((cell, ci) => (
        <div
          key={`${ri}-${ci}`}
          className={`tm-cell ${ri === 0 || ci === 0 ? 'tm-header' : 'tm-value'}`}
          style={ci > 0 && ri > 0 && row[ci] === p.toFixed(4) && p > 0 ? { color: 'var(--accent-rose)' } : {}}
        >
          {cell}
        </div>
      )))}
    </div>
  );
}

function HeatMap({ H, M, N }) {
  const displayN = Math.min(N, 200);
  const displayM = Math.min(M, 100);
  const cellSize = Math.max(3, Math.min(6, Math.floor(600 / displayN)));

  return (
    <div style={{ overflowX: 'auto' }}>
      <div
        className="matrix-grid"
        style={{ width: 'fit-content' }}
      >
        {Array.from({ length: displayM }, (_, row) => (
          <div key={row} className="matrix-row">
            {Array.from({ length: displayN }, (_, col) => (
              <div
                key={col}
                className={`matrix-cell ${H[row * N + col] === 1 ? 'one' : 'zero'}`}
                style={{ width: cellSize, height: cellSize }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function BlockDiagram() {
  const blocks = [
    {
      label: 'Saturated Source',
      detail: 'u ∈ GF(2)^K',
      color: '#8b5cf6',
      icon: '📡',
      note: 'Random binary bits',
    },
    {
      label: 'LDPC Encoder',
      detail: 'c = uG mod 2',
      color: '#3b82f6',
      icon: '⚙️',
      note: 'Systematic GF(2) encoding',
    },
    {
      label: 'Wired Channel',
      detail: 'Lossless: y=c | BSC: y=c⊕z',
      color: '#06b6d4',
      icon: '📶',
      note: 'Primary: Lossless Wired',
    },
    {
      label: 'LDPC Decoder',
      detail: 'Belief Propagation',
      color: '#10b981',
      icon: '🔄',
      note: 'Min-Sum iterative decoding',
    },
    {
      label: 'Recovered Data',
      detail: 'û = first K bits',
      color: '#3b82f6',
      icon: '✅',
      note: 'Systematic bit extraction',
    },
    {
      label: 'BER Calculation',
      detail: 'BER = errors / total',
      color: '#f43f5e',
      icon: '📊',
      note: 'Raw BER and LDPC BER',
    },
  ];

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '32px',
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        {blocks.map((b, i) => (
          <React.Fragment key={b.label}>
            <div style={{
              width: 280,
              background: 'var(--bg-elevated)',
              border: `1px solid ${b.color}55`,
              borderRadius: 12,
              padding: '14px 20px',
              textAlign: 'center',
              position: 'relative',
            }}>
              <div style={{ position: 'absolute', top: 10, left: 14, fontSize: '1rem' }}>{b.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: b.color }}>{b.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-code)', marginTop: 4 }}>{b.detail}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{b.note}</div>
            </div>
            {i < blocks.length - 1 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0,
              }}>
                <div style={{ width: 2, height: 20, background: `linear-gradient(${b.color}, ${blocks[i+1].color})` }} />
                <div style={{ fontSize: '12px', color: blocks[i+1].color }}>▼</div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
