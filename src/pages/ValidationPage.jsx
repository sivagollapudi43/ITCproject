import React, { useState } from 'react';
import {
  generateLDPCMatrix, buildGeneratorMatrix,
  generateSource, encode, losslessChannel, bscChannel,
  computeSyndrome, syndromeIsZero, syndromeWeight,
  countErrors, calcBER,
  beliefPropagationDecode, recoverInfo,
  runValidationTests, runSimulation,
} from '../core/ldpc';

const TESTS_DEF = [
  { id: 1, name: 'Hc^T = 0 (Encoding Validity)', desc: 'Verify the encoded codeword satisfies all parity-check equations.', dep: 'lossless' },
  { id: 2, name: 'Lossless Channel: y = c', desc: 'Received word must equal transmitted codeword in lossless mode.', dep: 'lossless' },
  { id: 3, name: 'Hy^T = 0 (Lossless Syndrome)', desc: 'Syndrome of received word is zero in lossless channel.', dep: 'lossless' },
  { id: 4, name: 'û = u (Lossless Recovery)', desc: 'Recovered information matches original in lossless mode.', dep: 'lossless' },
  { id: 5, name: 'Lossless BER = 0', desc: 'BER must be exactly zero in the lossless channel.', dep: 'lossless' },
  { id: 6, name: 'BSC Raw BER ≈ p', desc: 'Raw channel BER should approximate the BSC flip probability p.', dep: 'bsc' },
  { id: 7, name: 'LDPC BER ≤ Raw BER', desc: 'LDPC decoded BER should be lower than raw channel BER for low noise.', dep: 'bsc' },
];

export default function ValidationPage() {
  const [running, setRunning] = useState(false);
  const [tests, setTests] = useState(null);
  const [K, setK] = useState(500);
  const [bscP, setBscP] = useState(0.01);
  const [log, setLog] = useState([]);

  async function runTests() {
    setRunning(true);
    setTests(null);
    setLog([]);

    await delay(30);

    const logLines = [];
    const appendLog = (msg) => { logLines.push(msg); setLog([...logLines]); };

    try {
      appendLog(`[1/4] Generating LDPC matrix for K=${K}…`);
      const matData = generateLDPCMatrix(K, 0.5);
      const { G, infoIdx } = buildGeneratorMatrix(matData.H, matData.M, matData.N);
      matData.G = G; matData.infoIdx = infoIdx;
      const { H, M, N, K_eff } = matData;

      appendLog(`      H matrix: ${M}×${N}, K_eff=${K_eff}`);
      appendLog(`[2/4] Running lossless simulation…`);

      const simLossless = runSimulation({
        K, rate: 0.5, channelMode: 'lossless', p: 0, maxIter: 20, existingMatrix: matData,
      });

      appendLog(`      Lossless: rawBER=${simLossless.rawBER}, ldpcBER=${simLossless.ldpcBER}, encValid=${simLossless.encValid}`);
      appendLog(`[3/4] Running BSC simulation with p=${bscP}…`);

      const simBSC = runSimulation({
        K, rate: 0.5, channelMode: 'bsc', p: bscP, maxIter: 20, existingMatrix: matData,
      });

      appendLog(`      BSC: channelErrors=${simBSC.channelErrors}, rawBER=${simBSC.rawBER.toFixed(6)}, ldpcBER=${simBSC.ldpcBER.toFixed(6)}`);
      appendLog(`[4/4] Running validation tests…`);

      const testResults = runValidationTests(matData, simLossless, simBSC, bscP);
      setTests(testResults);

      const passed = testResults.filter(t => t.pass).length;
      appendLog(`\nCompleted: ${passed}/${testResults.length} tests PASSED.`);
    } catch (err) {
      appendLog(`ERROR: ${err.message}`);
      console.error(err);
    }

    setRunning(false);
  }

  const allPassed = tests && tests.every(t => t.pass);
  const numPassed = tests ? tests.filter(t => t.pass).length : 0;

  return (
    <div>
      <div className="page-header">
        <h1>✅ Validation Tests</h1>
        <p>Automated verification of all mathematical properties of the LDPC simulation</p>
      </div>
      <div className="page-body">

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">Test Parameters</div>
          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="form-group">
              <label className="form-label">K (info bits)</label>
              <select className="form-control" value={K} onChange={e => setK(+e.target.value)}>
                {[100, 200, 500, 1000].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">BSC p (for tests 6 & 7)</label>
              <select className="form-control" value={bscP} onChange={e => setBscP(+e.target.value)}>
                {[0.001, 0.005, 0.01, 0.02, 0.05].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <button className="btn btn-success btn-lg" onClick={runTests} disabled={running}>
              {running ? <><span className="loader" /> Running Tests…</> : '▶ Run All Validation Tests'}
            </button>
          </div>
        </div>

        {/* Test definitions */}
        <div className="section-title">Test Suite Definition</div>
        <div style={{ marginBottom: 24 }}>
          {TESTS_DEF.map(t => (
            <div key={t.id} style={{
              display: 'flex', gap: 16, padding: '12px 16px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 8, marginBottom: 8,
              alignItems: 'flex-start',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: tests
                  ? (tests.find(r => r.id === t.id)?.pass ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)')
                  : 'var(--bg-elevated)',
                border: `2px solid ${tests
                  ? (tests.find(r => r.id === t.id)?.pass ? 'var(--accent-emerald)' : 'var(--accent-rose)')
                  : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, color: tests
                  ? (tests.find(r => r.id === t.id)?.pass ? 'var(--accent-emerald)' : 'var(--accent-rose)')
                  : 'var(--text-muted)',
                flexShrink: 0,
                transition: 'all 0.3s',
              }}>
                {tests
                  ? (tests.find(r => r.id === t.id)?.pass ? '✓' : '✗')
                  : t.id
                }
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 2 }}>
                  Test {t.id}: {t.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.desc}</div>
                {tests && tests.find(r => r.id === t.id) && (
                  <div style={{ marginTop: 6, fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-code)' }}>
                    Detail: {tests.find(r => r.id === t.id).detail}
                  </div>
                )}
              </div>
              <span className="badge" style={{ flexShrink: 0 }}>
                {t.dep === 'lossless' ? '📡 Lossless' : `🔊 BSC p=${bscP}`}
              </span>
            </div>
          ))}
        </div>

        {/* Results summary */}
        {tests && (
          <div className="fade-in">
            <div className={`alert ${allPassed ? 'alert-success' : 'alert-warning'}`} style={{ marginBottom: 20 }}>
              <span>{allPassed ? '🎉' : '⚠️'}</span>
              <div>
                <strong>
                  {allPassed
                    ? `All ${tests.length} tests PASSED!`
                    : `${numPassed}/${tests.length} tests passed.`
                  }
                </strong>
                {' '}
                {allPassed
                  ? 'The LDPC simulation is mathematically correct. All properties verified.'
                  : 'Some tests did not pass. This may be due to statistical variance (especially Test 6 at low N) or decoding failure at high noise.'
                }
              </div>
            </div>

            <div className="stat-grid" style={{ marginBottom: 24 }}>
              <StatCard label="Tests Passed" value={`${numPassed}/${tests.length}`} color={allPassed ? 'accent-emerald' : 'accent-amber'} />
              <StatCard label="Pass Rate" value={`${Math.round(numPassed/tests.length*100)}%`} color={allPassed ? 'accent-emerald' : 'accent-amber'} />
              <StatCard label="K Used" value={K} color="accent-blue" />
              <StatCard label="BSC p" value={bscP} color="accent-amber" />
            </div>
          </div>
        )}

        {/* Log output */}
        {log.length > 0 && (
          <div className="card">
            <div className="card-title">Simulation Log</div>
            <div className="bits-display" style={{ fontSize: '0.78rem', maxHeight: 200, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
              {log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}

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

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
