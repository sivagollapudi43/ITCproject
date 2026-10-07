import React, { useState, useRef, useCallback } from 'react';
import {
  generateSource, describeSource,
  generateLDPCMatrix, buildGeneratorMatrix, matrixStats,
  encode, computeSyndrome, syndromeIsZero, syndromeWeight,
  losslessChannel, bscChannel,
  countErrors, calcBER,
  beliefPropagationDecode, recoverInfo,
  runSimulation,
} from '../core/ldpc';

const K_OPTIONS  = [100, 500, 1000, 5000, 10000, 50000];
const P_OPTIONS  = [0, 0.001, 0.005, 0.01, 0.02, 0.05, 0.10];
const ITER_OPTIONS = [5, 10, 20, 50];

const STEP_LABELS = ['Source', 'Encode', 'Transmit', 'Decode', 'BER'];

export default function SimulationPage({ setSharedState }) {
  // ─── Parameters ───────────────────────────────────────────
  const [K, setK] = useState(1000);
  const [rate, setRate] = useState(0.5);
  const [channelMode, setChannelMode] = useState('lossless');
  const [noiseP, setNoiseP] = useState(0.01);
  const [maxIter, setMaxIter] = useState(20);

  // ─── Simulation state ─────────────────────────────────────
  const [step, setStep] = useState(0);  // 0=idle, 1..5=done steps
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  // Per-step results
  const [sourceInfo, setSourceInfo] = useState(null);
  const [encodeInfo, setEncodeInfo] = useState(null);
  const [channelInfo, setChannelInfo] = useState(null);
  const [decodeInfo, setDecodeInfo] = useState(null);
  const [berInfo, setBerInfo] = useState(null);

  // Reuse matrix across steps
  const matrixRef = useRef(null);
  const simDataRef = useRef(null);  // full simulation data

  function reset() {
    setStep(0);
    setSourceInfo(null);
    setEncodeInfo(null);
    setChannelInfo(null);
    setDecodeInfo(null);
    setBerInfo(null);
    matrixRef.current = null;
    simDataRef.current = null;
    setError(null);
  }

  // ─── Step-by-step simulation ───────────────────────────────

  async function runStep(stepNum) {
    setRunning(true);
    setError(null);
    try {
      await delay(30); // let UI update

      if (stepNum === 1) {
        // STEP 1: Generate source + matrix
        const Klimited = Math.min(K, 50000);
        const matData = generateLDPCMatrix(Klimited, rate);
        const { G, infoIdx, parityIdx } = buildGeneratorMatrix(matData.H, matData.M, matData.N);
        matData.G = G; matData.infoIdx = infoIdx; matData.parityIdx = parityIdx;
        matrixRef.current = matData;

        const u = generateSource(matData.K_eff);
        const srcDesc = describeSource(u);
        simDataRef.current = { u };
        setSourceInfo({ u, ...srcDesc, N: matData.N, M: matData.M, K_eff: matData.K_eff, rate: matData.K_eff / matData.N });
        setStep(1);

      } else if (stepNum === 2) {
        // STEP 2: Encode
        if (!matrixRef.current || !simDataRef.current?.u) throw new Error('Run Step 1 first');
        const { H, M, N, K_eff, G, infoIdx } = matrixRef.current;
        const { u } = simDataRef.current;
        const c = encode(u, G, K_eff, N);
        const synEnc = computeSyndrome(H, c, M, N);
        const encValid = syndromeIsZero(synEnc);
        simDataRef.current = { ...simDataRef.current, c };
        setEncodeInfo({ c, N, K_eff, encValid, synWeight: syndromeWeight(synEnc) });
        setStep(2);

      } else if (stepNum === 3) {
        // STEP 3: Transmit through channel
        if (!simDataRef.current?.c) throw new Error('Run Step 2 first');
        const { c } = simDataRef.current;
        const N = c.length;
        const actualP = channelMode === 'lossless' ? 0 : noiseP;
        const y = channelMode === 'lossless' ? losslessChannel(c) : bscChannel(c, noiseP);
        const channelErrors = countErrors(c, y, N);
        const rawBER = calcBER(channelErrors, N);
        simDataRef.current = { ...simDataRef.current, y, actualP };
        setChannelInfo({ y, N, channelMode, actualP, channelErrors, rawBER });
        setStep(3);

      } else if (stepNum === 4) {
        // STEP 4: Decode
        if (!simDataRef.current?.y) throw new Error('Run Step 3 first');
        const { y, actualP } = simDataRef.current;
        const { H, M, N, K_eff, infoIdx } = matrixRef.current;
        const { decoded, iterations, syndromeInit, syndromeFinal, converged } =
          beliefPropagationDecode(y, H, M, N, actualP, maxIter);
        const uHat = recoverInfo(decoded, infoIdx, K_eff);
        simDataRef.current = { ...simDataRef.current, decoded, uHat };
        setDecodeInfo({
          decoded, uHat, K_eff, iterations, converged,
          synInitWeight: syndromeWeight(syndromeInit),
          synFinalWeight: syndromeWeight(syndromeFinal),
          synInitPreview: Array.from(syndromeInit.slice(0, 30)).join(''),
          synFinalPreview: Array.from(syndromeFinal.slice(0, 30)).join(''),
        });
        setStep(4);

      } else if (stepNum === 5) {
        // STEP 5: BER
        if (!simDataRef.current?.uHat) throw new Error('Run Step 4 first');
        const { u, c, y, uHat, actualP } = simDataRef.current;
        const N = c.length;
        const K_eff = u.length;
        const channelErrors = countErrors(c, y, N);
        const rawBER = calcBER(channelErrors, N);
        const infoErrors = countErrors(u, uHat, K_eff);
        const ldpcBER = calcBER(infoErrors, K_eff);
        const corrected = Math.max(0, channelErrors - infoErrors);
        setBerInfo({ rawBER, ldpcBER, channelErrors, infoErrors, corrected, N, K_eff, actualP });
        setStep(5);

        // Share with validation page
        if (setSharedState) {
          setSharedState({
            matrixData: matrixRef.current,
            u, c, y, uHat,
            channelMode, noiseP: actualP,
            rawBER, ldpcBER, channelErrors, infoErrors,
          });
        }
      }
    } catch (err) {
      setError(err.message);
    }
    setRunning(false);
  }

  async function runComplete() {
    reset();
    await delay(50);
    setRunning(true);
    try {
      for (let s = 1; s <= 5; s++) {
        await delay(20);
        await runStep(s);
      }
    } catch(e) { setError(e.message); }
    setRunning(false);
  }

  const canStep = (s) => !running && (s === 1 || step >= s - 1);

  return (
    <div>
      <div className="page-header">
        <h1>⚡ Simulation</h1>
        <p>Step-by-step LDPC simulation: source generation → encoding → channel → decoding → BER</p>
      </div>
      <div className="page-body">

        {/* Parameter Panel */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">Simulation Parameters</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Information Bits K</label>
              <select className="form-control" value={K} onChange={e => { setK(+e.target.value); reset(); }}>
                {K_OPTIONS.map(v => <option key={v} value={v}>{v.toLocaleString()}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Code Rate R</label>
              <select className="form-control" value={rate} onChange={e => { setRate(+e.target.value); reset(); }}>
                <option value={0.5}>1/2</option>
                <option value={0.33}>1/3</option>
                <option value={0.67}>2/3</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Channel Mode</label>
              <select className="form-control" value={channelMode} onChange={e => { setChannelMode(e.target.value); reset(); }}>
                <option value="lossless">Lossless Wired Channel</option>
                <option value="bsc">Controlled Noise (BSC)</option>
              </select>
            </div>
            {channelMode === 'bsc' && (
              <div className="form-group">
                <label className="form-label">Noise Probability p</label>
                <select className="form-control" value={noiseP} onChange={e => { setNoiseP(+e.target.value); reset(); }}>
                  {P_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Max BP Iterations</label>
              <select className="form-control" value={maxIter} onChange={e => setMaxIter(+e.target.value)}>
                {ITER_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Channel mode alert */}
          {channelMode === 'lossless' ? (
            <div className="alert alert-success">
              <span>✅</span>
              <div>
                <strong>Lossless Wired Channel selected.</strong> This is the baseline experiment (EVEN registration → wired channel).
                Expected result: Channel Errors = 0, Raw BER = 0, LDPC BER = 0.
                LDPC has no errors to correct.
              </div>
            </div>
          ) : (
            <div className="alert alert-warning">
              <span>⚠️</span>
              <div>
                <strong>Controlled Noise (BSC) selected.</strong> This is the noise performance experiment.
                Bits will be flipped with probability p = {noiseP}. Raw BER ≈ {noiseP}. LDPC will attempt error correction.
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="btn-group">
            <button className="btn btn-success btn-lg" onClick={runComplete} disabled={running}>
              {running ? <><span className="loader" /> Running…</> : '🚀 Run Complete Simulation'}
            </button>
            <button 
              className="btn btn-lg" 
              style={{ background: 'var(--gradient-fail)', color: '#fff' }}
              onClick={() => {
                setChannelMode('bsc');
                setNoiseP(0.01);
                setTimeout(() => runComplete(), 10);
              }} 
              disabled={running}
            >
              🔊 Quick Noise Test (p=0.01)
            </button>
            <div className="or-separator" style={{ width: 30 }}>or</div>
            <button className="btn btn-primary" onClick={() => runStep(1)} disabled={!canStep(1)}>1. Generate Source</button>
            <button className="btn btn-primary" onClick={() => runStep(2)} disabled={!canStep(2)}>2. Encode</button>
            <button className="btn btn-primary" onClick={() => runStep(3)} disabled={!canStep(3)}>3. Transmit</button>
            <button className="btn btn-primary" onClick={() => runStep(4)} disabled={!canStep(4)}>4. Decode</button>
            <button className="btn btn-primary" onClick={() => runStep(5)} disabled={!canStep(5)}>5. Calculate BER</button>
            <button className="btn btn-secondary" onClick={reset}>↺ Reset</button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <span>❌</span> <strong>Error:</strong> {error}
          </div>
        )}

        {/* Step progress */}
        <StepProgress step={step} running={running} />

        {/* Results sections */}
        {sourceInfo && <SourceSection info={sourceInfo} />}
        {encodeInfo  && <EncodeSection info={encodeInfo} />}
        {channelInfo && <ChannelSection info={channelInfo} />}
        {decodeInfo  && <DecodeSection info={decodeInfo} />}
        {berInfo     && <BerSection info={berInfo} channelMode={channelMode} />}

        {step === 5 && berInfo && (
          <div className="alert alert-success fade-in" style={{ marginTop: 24 }}>
            <span>🎉</span>
            <div>
              <strong>Simulation Complete!</strong> All 5 steps executed successfully.
              {channelMode === 'lossless'
                ? ' Lossless channel verified: BER = 0 throughout.'
                : ` BSC noise p=${berInfo.actualP}: Raw BER=${berInfo.rawBER.toFixed(6)}, LDPC BER=${berInfo.ldpcBER.toFixed(6)}.`
              }
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Step Progress Bar ─────────────────────────────────────
function StepProgress({ step, running }) {
  return (
    <div style={{ marginBottom: 24, padding: '16px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const done = step >= stepNum;
          const active = running && step === stepNum - 1;
          return (
            <div key={label} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', margin: '0 auto 6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700,
                background: done ? 'var(--accent-emerald)' : active ? 'var(--accent-blue)' : 'var(--bg-elevated)',
                color: done || active ? '#fff' : 'var(--text-muted)',
                border: `2px solid ${done ? 'var(--accent-emerald)' : active ? 'var(--accent-blue)' : 'var(--border)'}`,
                transition: 'all 0.3s',
              }}>
                {done ? '✓' : stepNum}
              </div>
              <div style={{ fontSize: '0.7rem', color: done ? 'var(--accent-emerald)' : 'var(--text-muted)', fontWeight: done ? 600 : 400 }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(step / 5) * 100}%` }} />
      </div>
    </div>
  );
}

// ─── Section Components ────────────────────────────────────

function SourceSection({ info }) {
  const { K_eff, K, ones, zeros, preview, N, M, rate } = info;
  return (
    <div className="card fade-in" style={{ marginBottom: 20, borderColor: 'rgba(139,92,246,0.4)' }}>
      <div className="card-title" style={{ color: 'var(--accent-violet)' }}>Step 1 — Information Source</div>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <StatCard label="Requested K" value={K?.toLocaleString() || K_eff?.toLocaleString()} color="accent-violet" />
        <StatCard label="Effective K (from matrix)" value={K_eff?.toLocaleString()} color="accent-violet" />
        <StatCard label="Codeword Length N" value={N} color="accent-blue" />
        <StatCard label="Parity Bits M" value={M} color="accent-cyan" />
        <StatCard label="Code Rate R" value={(K_eff/N).toFixed(4)} color="accent-amber" />
        <StatCard label="Ones" value={ones} color="accent-emerald" />
        <StatCard label="Zeros" value={zeros} color="accent-rose" />
        <StatCard label="Balance" value={((ones/K_eff)*100).toFixed(1)+'%'} color="accent-amber" />
      </div>
      <div className="card-title">First 100 Information Bits (u):</div>
      <div className="bits-display">{preview || '—'}</div>
      <div className="helper-text">u ∈ GF(2)^K — randomly generated i.i.d. binary sequence</div>
    </div>
  );
}

function EncodeSection({ info }) {
  const { c, N, K_eff, encValid, synWeight } = info;
  const preview = c ? Array.from(c.slice(0, 100)).join('') : '—';
  return (
    <div className="card fade-in" style={{ marginBottom: 20, borderColor: encValid ? 'rgba(59,130,246,0.4)' : 'rgba(244,63,94,0.4)' }}>
      <div className="card-title" style={{ color: 'var(--accent-blue)' }}>Step 2 — LDPC Encoder</div>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <StatCard label="K (info bits)" value={K_eff} color="accent-violet" />
        <StatCard label="N (codeword)" value={N} color="accent-blue" />
        <StatCard label="Parity Check Hc^T=0" value={encValid ? 'PASS ✓' : 'FAIL ✗'} color={encValid ? 'accent-emerald' : 'accent-rose'} />
        <StatCard label="Syndrome Weight" value={synWeight} color={synWeight === 0 ? 'accent-emerald' : 'accent-rose'} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <span className={encValid ? 'badge badge-pass' : 'badge badge-fail'}>
          {encValid ? '✓ Encoding VALID — Hc^T = 0' : '✗ Encoding INVALID — Hc^T ≠ 0'}
        </span>
      </div>
      <div className="card-title">First 100 Encoded Bits (c):</div>
      <div className="bits-display">{preview}</div>
      <div className="helper-text">c = u · G mod 2 — systematic codeword, first K bits are information bits</div>
    </div>
  );
}

function ChannelSection({ info }) {
  const { y, N, channelMode, actualP, channelErrors, rawBER } = info;
  const preview = y ? Array.from(y.slice(0, 100)).join('') : '—';
  const isLossless = channelMode === 'lossless';
  return (
    <div className="card fade-in" style={{ marginBottom: 20, borderColor: isLossless ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)' }}>
      <div className="card-title" style={{ color: isLossless ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
        Step 3 — {isLossless ? 'Lossless Wired Channel' : 'Binary Symmetric Channel (BSC)'}
      </div>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <StatCard label="Transmitted Bits N" value={N} color="accent-blue" />
        <StatCard label="Channel Errors" value={channelErrors} color={channelErrors === 0 ? 'accent-emerald' : 'accent-amber'} />
        <StatCard label="Raw BER" value={rawBER.toFixed(6)} color={rawBER === 0 ? 'accent-emerald' : 'accent-amber'} />
        {!isLossless && <StatCard label="Flip Prob p" value={actualP} color="accent-amber" />}
      </div>
      {isLossless ? (
        <div className="alert alert-success">
          <span>✅</span>
          <div>
            <strong>Lossless Channel Verified:</strong> y = c (no bit changes).
            Channel Errors = 0. Raw BER = 0.
            Mathematical model: P(Y=i|X=i) = 1 for all i ∈ {'{'}0,1{'}'}.
          </div>
        </div>
      ) : (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <div>
            <strong>BSC Applied:</strong> y_i = c_i XOR z_i, z_i ~ Bernoulli({actualP}).
            {channelErrors} bits flipped. Raw BER = {rawBER.toFixed(6)} ≈ p = {actualP}.
          </div>
        </div>
      )}
      <div className="card-title" style={{ marginTop: 12 }}>First 100 Received Bits (y):</div>
      <div className="bits-display">{preview}</div>
    </div>
  );
}

function DecodeSection({ info }) {
  const { uHat, K_eff, iterations, converged, synInitWeight, synFinalWeight, synInitPreview, synFinalPreview } = info;
  const uHatPreview = uHat ? Array.from(uHat.slice(0, 100)).join('') : '—';
  return (
    <div className="card fade-in" style={{ marginBottom: 20, borderColor: converged ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)' }}>
      <div className="card-title" style={{ color: converged ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
        Step 4 — LDPC Decoder (Belief Propagation)
      </div>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <StatCard label="Iterations Used" value={iterations} color="accent-blue" />
        <StatCard label="Converged" value={converged ? 'YES ✓' : 'NO ✗'} color={converged ? 'accent-emerald' : 'accent-amber'} />
        <StatCard label="Initial Syndrome Weight" value={synInitWeight} color={synInitWeight === 0 ? 'accent-emerald' : 'accent-rose'} />
        <StatCard label="Final Syndrome Weight" value={synFinalWeight} color={synFinalWeight === 0 ? 'accent-emerald' : 'accent-amber'} />
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="helper-text" style={{ marginBottom: 4 }}>Initial Syndrome s₀ = Hy^T (first 30 bits):</div>
          <div className="bits-display" style={{ fontSize: '0.72rem', padding: '8px 12px', maxHeight: 50 }}>{synInitPreview || '—'}</div>
        </div>
        <div>
          <div className="helper-text" style={{ marginBottom: 4 }}>Final Syndrome s_f (first 30 bits):</div>
          <div className="bits-display" style={{ fontSize: '0.72rem', padding: '8px 12px', maxHeight: 50 }}>{synFinalPreview || '—'}</div>
        </div>
      </div>
      <div className="card-title">First 100 Recovered Info Bits (û):</div>
      <div className="bits-display">{uHatPreview}</div>
      <div className="helper-text">û = first {K_eff} bits of decoded codeword (systematic extraction)</div>
    </div>
  );
}

function BerSection({ info, channelMode }) {
  const { rawBER, ldpcBER, channelErrors, infoErrors, corrected, N, K_eff, actualP } = info;
  const improvement = rawBER > 0 ? ((rawBER - ldpcBER) / rawBER * 100) : 0;
  const isLossless = channelMode === 'lossless';
  return (
    <div className="card fade-in" style={{ marginBottom: 20, borderColor: 'rgba(244,63,94,0.4)' }}>
      <div className="card-title" style={{ color: 'var(--accent-rose)' }}>Step 5 — BER Analysis</div>
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard label="Raw Channel BER" value={rawBER.toFixed(6)} color={rawBER === 0 ? 'accent-emerald' : 'accent-rose'} />
        <StatCard label="LDPC BER" value={ldpcBER.toFixed(6)} color={ldpcBER === 0 ? 'accent-emerald' : 'accent-amber'} />
        <StatCard label="Channel Errors" value={channelErrors} color={channelErrors === 0 ? 'accent-emerald' : 'accent-amber'} />
        <StatCard label="Info Bit Errors" value={infoErrors} color={infoErrors === 0 ? 'accent-emerald' : 'accent-rose'} />
        <StatCard label="Corrected Errors" value={corrected} color="accent-emerald" />
        <StatCard label="BER Improvement" value={isLossless ? 'N/A' : improvement.toFixed(1) + '%'} color="accent-violet" />
      </div>

      {isLossless ? (
        <div className="alert alert-success">
          <span>✅</span>
          <div>
            <strong>Lossless Channel Baseline Result:</strong><br />
            Channel Errors = 0 | Raw BER = 0.000000 | LDPC BER = 0.000000<br />
            Because the ideal lossless channel introduces no errors, LDPC has no errors to correct in this baseline experiment.
            All parity checks satisfied: Hc^T = 0, Hy^T = 0, û = u.
          </div>
        </div>
      ) : (
        <div className="alert alert-info">
          <span>📊</span>
          <div>
            <strong>BSC Noise Experiment (p={actualP}):</strong><br />
            Raw BER = {rawBER.toFixed(6)} (approximately equal to p = {actualP})<br />
            LDPC BER = {ldpcBER.toFixed(6)} (after belief propagation decoding)<br />
            {ldpcBER < rawBER
              ? `LDPC successfully reduced BER by ${improvement.toFixed(1)}% (${corrected} errors corrected).`
              : ldpcBER === 0
                ? 'LDPC achieved perfect error correction.'
                : 'LDPC could not fully correct all errors at this noise level.'
            }
          </div>
        </div>
      )}

      {/* Comparison table */}
      <div className="table-container" style={{ marginTop: 16 }}>
        <table>
          <thead><tr><th>Metric</th><th>Value</th><th>Formula</th></tr></thead>
          <tbody>
            <tr><td>Transmitted Coded Bits</td><td>{N}</td><td style={{fontFamily:'var(--font-sans)'}}>N (codeword length)</td></tr>
            <tr><td>Information Bits</td><td>{K_eff}</td><td style={{fontFamily:'var(--font-sans)'}}>K (effective)</td></tr>
            <tr><td>Channel Bit Errors</td><td>{channelErrors}</td><td style={{fontFamily:'var(--font-sans)'}}>|{'{'} i : y_i ≠ c_i {'}'}|</td></tr>
            <tr><td style={{color:'var(--accent-rose)'}}>Raw BER</td><td style={{color:'var(--accent-rose)'}}>{rawBER.toFixed(8)}</td><td style={{fontFamily:'var(--font-sans)'}}>Channel Errors / N</td></tr>
            <tr><td>Info Bit Errors</td><td>{infoErrors}</td><td style={{fontFamily:'var(--font-sans)'}}>|{'{'} i : û_i ≠ u_i {'}'}|</td></tr>
            <tr><td style={{color:'var(--accent-amber)'}}>LDPC BER</td><td style={{color:'var(--accent-amber)'}}>{ldpcBER.toFixed(8)}</td><td style={{fontFamily:'var(--font-sans)'}}>Info Errors / K</td></tr>
          </tbody>
        </table>
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
