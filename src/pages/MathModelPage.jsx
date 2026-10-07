import React from 'react';

export default function MathModelPage() {
  return (
    <div>
      <div className="page-header">
        <h1>∑ Mathematical Model</h1>
        <p>Formal mathematical description of every component in the LDPC simulation</p>
      </div>
      <div className="page-body">

        <div className="banner banner-info">
          <span className="banner-icon">📐</span>
          <div>
            All symbols are defined below. Every formula is implemented exactly in the simulation engine.
          </div>
        </div>

        {/* 1. Information Source */}
        <MathSection num={1} title="Information Source">
          <SymTable rows={[
            ['u', 'Information vector (source bits)'],
            ['K', 'Number of information bits'],
            ['u_i', 'i-th information bit, u_i ∈ {0, 1}'],
            ['GF(2)', 'Galois Field of order 2 (binary field)'],
          ]} />
          <MathBlock>{`u = [u₁, u₂, ..., u_K]  ∈  GF(2)^K

Each u_i is independently and uniformly drawn from {0, 1}.`}</MathBlock>
          <Note>The source is a binary i.i.d. random process. Each bit has equal probability of being 0 or 1.</Note>
        </MathSection>

        {/* 2. LDPC Parity-Check Matrix */}
        <MathSection num={2} title="LDPC Parity-Check Matrix">
          <SymTable rows={[
            ['H', 'Parity-check matrix'],
            ['M', 'Number of parity-check equations (rows of H)'],
            ['N', 'Codeword length (columns of H)'],
            ['d_v', 'Column weight (number of 1s per column)'],
            ['d_c', 'Row weight (number of 1s per row)'],
          ]} />
          <MathBlock>{`H  ∈  GF(2)^(M × N)

Where:
  N = K / R         (codeword length)
  M = N - K         (number of parity bits)
  R = K / N         (code rate)

H is sparse: density ≈ d_v / M  ≪  1
(typical d_v = 3, d_c = 6 for R = 1/2)`}</MathBlock>
          <Note>A Gallager-style construction is used: columns are systematically spread across rows in sub-matrix groups.</Note>
        </MathSection>

        {/* 3. Code Rate */}
        <MathSection num={3} title="Code Rate">
          <MathBlock>{`R = K / N

Default: R = 1/2  →  N = 2K

For every K information bits, N = 2K total bits are transmitted.
Overhead = N - K = K parity bits.`}</MathBlock>
        </MathSection>

        {/* 4. Generator Matrix */}
        <MathSection num={4} title="Generator Matrix and Encoding">
          <SymTable rows={[
            ['G', 'Generator matrix  G ∈ GF(2)^(K × N)'],
            ['c', 'Encoded codeword  c ∈ GF(2)^N'],
            ['u', 'Information vector  u ∈ GF(2)^K'],
          ]} />
          <MathBlock>{`c = u · G  (mod 2)

G is derived from H by GF(2) row reduction (systematic form):
  1. Row-reduce H to identify pivot (parity) columns
  2. Non-pivot columns are "free" (information) columns
  3. G = [I_K | P]  where P is the parity sub-matrix

Systematic structure:
  c = [u₁ u₂ ... u_K | p₁ p₂ ... p_M]
       ←— information bits —→ ←— parity bits —→`}</MathBlock>
        </MathSection>

        {/* 5. LDPC Constraint */}
        <MathSection num={5} title="LDPC Parity-Check Constraint">
          <MathBlock>{`For any valid codeword c:

    H · c^T  =  0   (mod 2)

This means every row equation of H is satisfied:
    Σ_j  H[i][j] · c[j]  =  0  (mod 2)   for all i = 1..M

Also:  H · G^T = 0  (by construction of G from H)`}</MathBlock>
          <Note>This is verified automatically after encoding. Any failure means a bug in the implementation.</Note>
        </MathSection>

        {/* 6. Lossless Wired Channel */}
        <MathSection num={6} title="Lossless Wired Channel">
          <SymTable rows={[
            ['y', 'Received vector  y ∈ GF(2)^N'],
            ['c', 'Transmitted codeword'],
          ]} />
          <MathBlock>{`y = c

For every bit:  y_i = c_i   (no bit can change)

Channel Transition Matrix:
    P = [[P(Y=0|X=0),  P(Y=1|X=0)],
         [P(Y=0|X=1),  P(Y=1|X=1)]]

      = [[1,  0],
         [0,  1]]

Result:
    Channel Errors  = 0
    Raw BER         = 0
    LDPC BER        = 0`}</MathBlock>
          <div className="alert alert-success" style={{ marginTop: 12 }}>
            The lossless channel is the BASELINE experiment required by the assignment (EVEN registration → wired channel).
          </div>
        </MathSection>

        {/* 7. BSC */}
        <MathSection num={7} title="Binary Symmetric Channel (BSC)">
          <SymTable rows={[
            ['p', 'Bit-flip probability (0 ≤ p ≤ 0.5)'],
            ['z_i', 'Noise bit  z_i ~ Bernoulli(p)'],
            ['y_i', 'Received bit'],
          ]} />
          <MathBlock>{`y_i = c_i  XOR  z_i

where:
    P(z_i = 1) = p      (bit is flipped)
    P(z_i = 0) = 1 - p  (bit is unchanged)

Channel Transition Matrix:
    P = [[1-p,  p ],
         [ p,   1-p]]

For p = 0:  BSC reduces to the lossless channel.
For large N:  Raw BER ≈ p   (law of large numbers)`}</MathBlock>
          <div className="alert alert-warning" style={{ marginTop: 12 }}>
            The BSC is used ONLY for the controlled-noise performance experiment.
            It is NOT the primary assignment channel (which is lossless wired).
          </div>
        </MathSection>

        {/* 8. Syndrome */}
        <MathSection num={8} title="Syndrome Calculation">
          <SymTable rows={[
            ['s', 'Syndrome vector  s ∈ GF(2)^M'],
            ['y', 'Received word'],
            ['H', 'Parity-check matrix'],
          ]} />
          <MathBlock>{`s = H · y^T   (mod 2)

If s = 0:  y satisfies all parity checks (no detectable error)
If s ≠ 0:  Parity checks violated → errors present

Syndrome weight  w(s) = number of 1s in s
                      = number of violated parity checks`}</MathBlock>
        </MathSection>

        {/* 9. Belief Propagation */}
        <MathSection num={9} title="Belief Propagation Decoding (Log-Domain)">
          <SymTable rows={[
            ['L_j', 'Log-likelihood ratio of variable node j'],
            ['Q_{j→i}', 'Message from variable j to check i'],
            ['R_{i→j}', 'Message from check i to variable j'],
            ['λ_j', 'Channel LLR for bit j'],
          ]} />
          <MathBlock>{`Channel LLR (BSC with flip probability p):
    λ_j = log[(1-p)/p]  if y_j = 0
    λ_j = -log[(1-p)/p] if y_j = 1

Iteration k:

Variable→Check (V→C) message:
    Q_{j→i}^(k) = λ_j + Σ_{i'≠i} R_{i'→j}^(k-1)

Check→Variable (C→V) message (Min-Sum approx.):
    R_{i→j}^(k) = (∏_{j'≠j} sign(Q_{j'→i}^(k))) × min_{j'≠j}|Q_{j'→i}^(k)|

Total LLR (hard decision):
    L_j^(k) = λ_j + Σ_i R_{i→j}^(k)
    ĉ_j = 0  if L_j ≥ 0,   ĉ_j = 1  if L_j < 0

Stop if  H · ĉ^T = 0  (syndrome is zero)`}</MathBlock>
        </MathSection>

        {/* 10. BER */}
        <MathSection num={10} title="Bit Error Rate (BER)">
          <MathBlock>{`Raw Channel BER:
    BER_raw = (number of incorrect coded bits) / N
            = |{i : y_i ≠ c_i}| / N

Post-LDPC BER (Information BER):
    BER_LDPC = (number of incorrect info bits) / K
             = |{i : û_i ≠ u_i}| / K

For lossless channel:
    BER_raw = 0,  BER_LDPC = 0

For BSC with large N:
    BER_raw ≈ p

For valid LDPC operating region (p below threshold):
    BER_LDPC  <  BER_raw   (LDPC corrects errors)`}</MathBlock>
        </MathSection>

      </div>
    </div>
  );
}

function MathSection({ num, title, children }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div className="section-title">
        <span style={{ color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>§{num}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function MathBlock({ children }) {
  return <pre className="math-block" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{children}</pre>;
}

function Note({ children }) {
  return (
    <div className="alert alert-info" style={{ marginTop: 8 }}>
      <span>💡</span>
      <span>{children}</span>
    </div>
  );
}

function SymTable({ rows }) {
  return (
    <div className="table-container" style={{ marginBottom: 12 }}>
      <table>
        <thead>
          <tr><th>Symbol</th><th>Description</th></tr>
        </thead>
        <tbody>
          {rows.map(([sym, desc]) => (
            <tr key={sym}>
              <td><span className="inline-math">{sym}</span></td>
              <td style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)' }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
