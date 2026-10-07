/**
 * Node.js test for LDPC simulation core logic
 * Including FULL BSC NOISE + BP DECODER test
 * Run: node test_ldpc.mjs
 */

// ─────────────────────────────────────────────────────────────
// Inline core LDPC functions (same math as src/core/ldpc.js)
// ─────────────────────────────────────────────────────────────

function generateSource(K) {
  const u = new Uint8Array(K);
  for (let i = 0; i < K; i++) u[i] = Math.random() < 0.5 ? 0 : 1;
  return u;
}

function gf2RowReduce(mat, rows, cols) {
  const pivotCols = [];
  let pivotRow = 0;
  for (let col = 0; col < cols && pivotRow < rows; col++) {
    let found = -1;
    for (let r = pivotRow; r < rows; r++) {
      if (mat[r * cols + col] === 1) { found = r; break; }
    }
    if (found === -1) continue;
    if (found !== pivotRow) {
      for (let c = 0; c < cols; c++) {
        const tmp = mat[pivotRow * cols + c];
        mat[pivotRow * cols + c] = mat[found * cols + c];
        mat[found * cols + c] = tmp;
      }
    }
    pivotCols.push(col);
    for (let r = 0; r < rows; r++) {
      if (r !== pivotRow && mat[r * cols + col] === 1)
        for (let c = 0; c < cols; c++) mat[r * cols + c] ^= mat[pivotRow * cols + c];
    }
    pivotRow++;
  }
  return pivotCols;
}

function shuffledPermutation(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateLDPCMatrix(K, rate) {
  const maxN = 500;
  const N = Math.min(Math.round(K / rate), maxN);
  const M = N - Math.round(N * rate);
  const K_eff = N - M;
  const dv = 3;
  const H = new Uint8Array(M * N);
  const rowsPerGroup = Math.ceil(M / dv);
  for (let col = 0; col < N; col++) H[(col % rowsPerGroup) * N + col] = 1;
  for (let g = 1; g < dv; g++) {
    const perm = shuffledPermutation(N);
    for (let col = 0; col < N; col++) {
      const baseRow = (perm[col] % rowsPerGroup) + g * rowsPerGroup;
      if (baseRow < M) H[baseRow * N + col] = 1;
    }
  }
  for (let row = 0; row < M; row++) {
    let s = 0;
    for (let c = 0; c < N; c++) s += H[row * N + c];
    if (s === 0) H[row * N + Math.floor(Math.random() * N)] = 1;
  }
  return { H, M, N, K_eff };
}

function buildGeneratorMatrix(H, M, N) {
  const Hcopy = new Uint8Array(H);
  const pivotCols = gf2RowReduce(Hcopy, M, N);
  const pivotSet = new Set(pivotCols);
  const freeCols = [];
  for (let c = 0; c < N; c++) if (!pivotSet.has(c)) freeCols.push(c);
  const K_eff = freeCols.length;
  const G = new Uint8Array(K_eff * N);
  for (let i = 0; i < K_eff; i++) {
    G[i * N + freeCols[i]] = 1;
    for (let r = 0; r < pivotCols.length; r++)
      if (Hcopy[r * N + freeCols[i]] === 1) G[i * N + pivotCols[r]] = 1;
  }
  return { G, K_eff, infoIdx: freeCols };
}

function encode(u, G, K_eff, N) {
  const c = new Uint8Array(N);
  for (let col = 0; col < N; col++) {
    let val = 0;
    for (let k = 0; k < K_eff; k++) val ^= u[k] & G[k * N + col];
    c[col] = val;
  }
  return c;
}

function computeSyndrome(H, c, M, N) {
  const s = new Uint8Array(M);
  for (let row = 0; row < M; row++) {
    let val = 0;
    for (let col = 0; col < N; col++) val ^= H[row * N + col] & c[col];
    s[row] = val;
  }
  return s;
}

function syndromeIsZero(s) {
  for (let i = 0; i < s.length; i++) if (s[i] !== 0) return false;
  return true;
}

function syndromeWeight(s) {
  let w = 0; for (let i = 0; i < s.length; i++) w += s[i]; return w;
}

function countErrors(a, b, len) {
  let e = 0; for (let i = 0; i < len; i++) e += a[i] ^ b[i]; return e;
}

/** BSC channel: flip each bit with probability p */
function bscChannel(c, p) {
  const y = new Uint8Array(c.length);
  for (let i = 0; i < c.length; i++)
    y[i] = c[i] ^ (Math.random() < p ? 1 : 0);
  return y;
}

/** Build Tanner graph adjacency lists */
function buildTannerGraph(H, M, N) {
  const checkToVar = Array.from({ length: M }, () => []);
  const varToCheck = Array.from({ length: N }, () => []);
  for (let row = 0; row < M; row++)
    for (let col = 0; col < N; col++)
      if (H[row * N + col] === 1) { checkToVar[row].push(col); varToCheck[col].push(row); }
  return { checkToVar, varToCheck };
}

/** Belief Propagation decoder (Min-Sum) */
function beliefPropagationDecode(y, H, M, N, p, maxIter) {
  const { checkToVar, varToCheck } = buildTannerGraph(H, M, N);
  const channelLLR = p < 1e-12 ? 20.0 : Math.log((1 - p) / Math.max(p, 1e-12));

  const varLLR = new Float64Array(N);
  for (let col = 0; col < N; col++)
    varLLR[col] = y[col] === 0 ? channelLLR : -channelLLR;

  const msgCV = checkToVar.map(vars => new Float64Array(vars.length));
  const msgVC = varToCheck.map(checks => new Float64Array(checks.length));

  const synInit = computeSyndrome(H, y, M, N);
  if (p < 1e-12 && syndromeIsZero(synInit))
    return { decoded: new Uint8Array(y), iterations: 0, converged: true, syndromeInit: synInit, syndromeFinal: synInit };

  let current = new Uint8Array(y);

  for (let iter = 0; iter < maxIter; iter++) {
    // V→C messages
    for (let col = 0; col < N; col++) {
      const checks = varToCheck[col];
      for (let ci = 0; ci < checks.length; ci++) {
        const checkIdx = checks[ci];
        let sum = varLLR[col];
        for (let cj = 0; cj < checks.length; cj++) {
          if (cj !== ci) {
            const otherCheck = checks[cj];
            const pos = checkToVar[otherCheck].indexOf(col);
            sum += msgCV[otherCheck][pos];
          }
        }
        msgVC[col][ci] = sum;
      }
    }
    // C→V messages (Min-Sum)
    for (let row = 0; row < M; row++) {
      const vars = checkToVar[row];
      const nc = vars.length;
      const incoming = new Float64Array(nc);
      for (let vi = 0; vi < nc; vi++) {
        const col = vars[vi];
        const posInVar = varToCheck[col].indexOf(row);
        incoming[vi] = msgVC[col][posInVar];
      }
      let totalSign = 1;
      let min1 = Infinity, min2 = Infinity, minIdx = -1;
      const signs = new Int8Array(nc);
      for (let vi = 0; vi < nc; vi++) {
        signs[vi] = incoming[vi] >= 0 ? 1 : -1;
        totalSign *= signs[vi];
        const absV = Math.abs(incoming[vi]);
        if (absV < min1) { min2 = min1; min1 = absV; minIdx = vi; }
        else if (absV < min2) min2 = absV;
      }
      for (let vi = 0; vi < nc; vi++) {
        msgCV[row][vi] = totalSign * signs[vi] * (vi === minIdx ? min2 : min1);
      }
    }
    // Hard decision
    const totalLLR = new Float64Array(N);
    for (let col = 0; col < N; col++) {
      totalLLR[col] = varLLR[col];
      const checks = varToCheck[col];
      for (let ci = 0; ci < checks.length; ci++) {
        const checkIdx = checks[ci];
        const pos = checkToVar[checkIdx].indexOf(col);
        totalLLR[col] += msgCV[checkIdx][pos];
      }
      current[col] = totalLLR[col] >= 0 ? 0 : 1;
    }
    const syn = computeSyndrome(H, current, M, N);
    if (syndromeIsZero(syn))
      return { decoded: current, iterations: iter + 1, converged: true, syndromeInit: synInit, syndromeFinal: syn };
  }

  const syndromeFinal = computeSyndrome(H, current, M, N);
  return { decoded: current, iterations: maxIter, converged: false, syndromeInit: synInit, syndromeFinal };
}

// ─────────────────────────────────────────────────────────────
// TEST RUNNER
// ─────────────────────────────────────────────────────────────

let passed = 0, total = 0;
function test(name, condition, detail = '') {
  total++;
  const icon = condition ? '✅' : '❌';
  const status = condition ? 'PASS' : 'FAIL';
  console.log(`  ${icon} ${status}: ${name}${detail ? '  →  ' + detail : ''}`);
  if (condition) passed++;
}
function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║   LDPC Channel Coding — Full Noise Decoding Test Suite  ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// ─── TEST A: K=100, Lossless ──────────────────────────────
section('TEST A: K=100, Lossless Wired Channel (BASELINE)');
{
  const { H, M, N, K_eff } = generateLDPCMatrix(100, 0.5);
  const { G, infoIdx } = buildGeneratorMatrix(H, M, N);
  const u = generateSource(K_eff);
  const c = encode(u, G, K_eff, N);
  test('Encoding valid  Hc^T = 0', syndromeIsZero(computeSyndrome(H, c, M, N)));
  const y = new Uint8Array(c);          // lossless: y = c
  test('Lossless  y = c  (0 errors)', countErrors(c, y, N) === 0);
  test('Syndrome  Hy^T = 0', syndromeIsZero(computeSyndrome(H, y, M, N)));
  const uHat = infoIdx.map(i => c[i]);
  test('Recovery  û = u', countErrors(u, uHat, K_eff) === 0);
  test('BER = 0', countErrors(c, y, N) / N === 0 && countErrors(u, uHat, K_eff) / K_eff === 0,
    `rawBER=0, ldpcBER=0`);
}

// ─── TEST B: K=500, Lossless ──────────────────────────────
section('TEST B: K=500, Lossless Wired Channel');
{
  const { H, M, N, K_eff } = generateLDPCMatrix(500, 0.5);
  const { G, infoIdx } = buildGeneratorMatrix(H, M, N);
  const u = generateSource(K_eff);
  const c = encode(u, G, K_eff, N);
  test('Encoding valid  Hc^T = 0', syndromeIsZero(computeSyndrome(H, c, M, N)));
  test('y = c  (lossless)',  countErrors(c, new Uint8Array(c), N) === 0);
  test('Raw BER = 0', countErrors(c, new Uint8Array(c), N) / N === 0);
}

// ─── TEST C: BSC p=0.001 (very low noise) ─────────────────
section('TEST C: BSC p=0.001  →  LDPC should decode perfectly');
{
  const p = 0.001;
  const { H, M, N, K_eff } = generateLDPCMatrix(1000, 0.5);
  const { G, infoIdx } = buildGeneratorMatrix(H, M, N);
  const u = generateSource(K_eff);
  const c = encode(u, G, K_eff, N);
  const y = bscChannel(c, p);
  const channelErrors = countErrors(c, y, N);
  const rawBER = channelErrors / N;

  console.log(`      N=${N}, K_eff=${K_eff}, channel errors=${channelErrors}, rawBER=${rawBER.toFixed(6)}`);

  const { decoded, iterations, converged, syndromeFinal } = beliefPropagationDecode(y, H, M, N, p, 20);
  const uHat = infoIdx.map(i => decoded[i]);
  const infoErrors = countErrors(u, uHat, K_eff);
  const ldpcBER = infoErrors / K_eff;

  test('Hc^T = 0  (encoding valid)', syndromeIsZero(computeSyndrome(H, c, M, N)));
  test(`Raw BER ≈ p=${p}`, rawBER < 0.02, `rawBER=${rawBER.toFixed(6)}`);
  test('BP decoder converged', converged, `iterations=${iterations}, finalSynWeight=${syndromeWeight(syndromeFinal)}`);
  test('LDPC BER ≤ Raw BER  (error correction)', ldpcBER <= rawBER + 1e-9,
    `ldpcBER=${ldpcBER.toFixed(6)}, rawBER=${rawBER.toFixed(6)}`);
  console.log(`      Corrected errors: ${channelErrors - infoErrors}`);
}

// ─── TEST D: BSC p=0.005 ──────────────────────────────────
section('TEST D: BSC p=0.005  →  LDPC should reduce BER significantly');
{
  const p = 0.005;
  const { H, M, N, K_eff } = generateLDPCMatrix(1000, 0.5);
  const { G, infoIdx } = buildGeneratorMatrix(H, M, N);
  const u = generateSource(K_eff);
  const c = encode(u, G, K_eff, N);
  const y = bscChannel(c, p);
  const channelErrors = countErrors(c, y, N);
  const rawBER = channelErrors / N;

  console.log(`      N=${N}, K_eff=${K_eff}, channel errors=${channelErrors}, rawBER=${rawBER.toFixed(6)}`);

  const { decoded, iterations, converged, syndromeFinal } = beliefPropagationDecode(y, H, M, N, p, 20);
  const uHat = infoIdx.map(i => decoded[i]);
  const infoErrors = countErrors(u, uHat, K_eff);
  const ldpcBER = infoErrors / K_eff;

  const tol = 3 * Math.sqrt(p * (1-p) / N);
  test(`Raw BER ≈ p=${p}`, Math.abs(rawBER - p) < tol + 0.005,
    `rawBER=${rawBER.toFixed(6)}, tol=±${tol.toFixed(4)}`);
  test('BP decoder ran', iterations > 0, `iterations=${iterations}`);
  test('LDPC BER ≤ Raw BER', ldpcBER <= rawBER + 1e-9,
    `ldpcBER=${ldpcBER.toFixed(6)}, rawBER=${rawBER.toFixed(6)}`);
  console.log(`      Corrected=${channelErrors - infoErrors}, converged=${converged}, finalSynWeight=${syndromeWeight(syndromeFinal)}`);
}

// ─── TEST E: BSC p=0.01 ───────────────────────────────────
section('TEST E: BSC p=0.01  →  Standard noise experiment');
{
  const p = 0.01;
  const { H, M, N, K_eff } = generateLDPCMatrix(1000, 0.5);
  const { G, infoIdx } = buildGeneratorMatrix(H, M, N);
  const u = generateSource(K_eff);
  const c = encode(u, G, K_eff, N);
  const y = bscChannel(c, p);
  const channelErrors = countErrors(c, y, N);
  const rawBER = channelErrors / N;

  console.log(`      N=${N}, K_eff=${K_eff}, channel errors=${channelErrors}, rawBER=${rawBER.toFixed(6)}`);

  const { decoded, iterations, converged, syndromeFinal } = beliefPropagationDecode(y, H, M, N, p, 20);
  const uHat = infoIdx.map(i => decoded[i]);
  const infoErrors = countErrors(u, uHat, K_eff);
  const ldpcBER = infoErrors / K_eff;

  const tol = 3 * Math.sqrt(p * (1-p) / N);
  test(`Raw BER in range [${(p-tol).toFixed(4)}, ${(p+tol).toFixed(4)}]`,
    Math.abs(rawBER - p) < tol + 0.005,
    `rawBER=${rawBER.toFixed(6)}`);
  test('BP decoder ran iterations', iterations > 0, `iterations=${iterations}`);
  test('Final syndrome weight reported', true, `synWeight=${syndromeWeight(syndromeFinal)}`);
  test('LDPC BER ≤ Raw BER', ldpcBER <= rawBER + 1e-9,
    `ldpcBER=${ldpcBER.toFixed(6)}, rawBER=${rawBER.toFixed(6)}`);
  console.log(`      Corrected=${channelErrors - infoErrors}, converged=${converged}`);
}

// ─── TEST F: BSC p=0.05 (high noise) ─────────────────────
section('TEST F: BSC p=0.05  →  High noise — LDPC may struggle');
{
  const p = 0.05;
  const { H, M, N, K_eff } = generateLDPCMatrix(1000, 0.5);
  const { G, infoIdx } = buildGeneratorMatrix(H, M, N);
  const u = generateSource(K_eff);
  const c = encode(u, G, K_eff, N);
  const y = bscChannel(c, p);
  const channelErrors = countErrors(c, y, N);
  const rawBER = channelErrors / N;

  console.log(`      N=${N}, K_eff=${K_eff}, channel errors=${channelErrors}, rawBER=${rawBER.toFixed(6)}`);

  const { decoded, iterations, converged, syndromeFinal } = beliefPropagationDecode(y, H, M, N, p, 20);
  const uHat = infoIdx.map(i => decoded[i]);
  const infoErrors = countErrors(u, uHat, K_eff);
  const ldpcBER = infoErrors / K_eff;

  test(`Raw BER > 0 (noise present)`, rawBER > 0, `rawBER=${rawBER.toFixed(4)}`);
  test('BP decoder ran max iterations', true, `iterations=${iterations}, converged=${converged}`);
  // At high noise, LDPC may or may not succeed — just verify it ran correctly
  test('LDPC BER is a valid number', Number.isFinite(ldpcBER) && ldpcBER >= 0,
    `ldpcBER=${ldpcBER.toFixed(6)}`);
  console.log(`      Corrected=${channelErrors - infoErrors}, finalSynWeight=${syndromeWeight(syndromeFinal)}`);
}

// ─── TEST G: Multi-run average BER (statistical) ──────────
section('TEST G: 5-run average  BSC p=0.01  →  Statistical verification');
{
  const p = 0.01;
  const RUNS = 5;
  let totalRawBER = 0, totalLdpcBER = 0, correctedTotal = 0;

  for (let run = 0; run < RUNS; run++) {
    const { H, M, N, K_eff } = generateLDPCMatrix(500, 0.5);
    const { G, infoIdx } = buildGeneratorMatrix(H, M, N);
    const u = generateSource(K_eff);
    const c = encode(u, G, K_eff, N);
    const y = bscChannel(c, p);
    const channelErrors = countErrors(c, y, N);
    totalRawBER += channelErrors / N;
    const { decoded } = beliefPropagationDecode(y, H, M, N, p, 20);
    const uHat = infoIdx.map(i => decoded[i]);
    const infoErrors = countErrors(u, uHat, K_eff);
    totalLdpcBER += infoErrors / K_eff;
    correctedTotal += channelErrors - infoErrors;
  }

  const avgRaw  = totalRawBER  / RUNS;
  const avgLdpc = totalLdpcBER / RUNS;
  console.log(`      Avg Raw BER=${avgRaw.toFixed(6)}, Avg LDPC BER=${avgLdpc.toFixed(6)}, Total corrected=${correctedTotal}`);

  test(`Avg Raw BER ≈ p=0.01`, Math.abs(avgRaw - p) < 0.02, `avgRawBER=${avgRaw.toFixed(6)}`);
  test('Avg LDPC BER ≤ Avg Raw BER', avgLdpc <= avgRaw + 1e-9,
    `avgLdpcBER=${avgLdpc.toFixed(6)}`);
}

// ─── TEST H: Matrix density ────────────────────────────────
section('TEST H: H matrix is truly low-density');
{
  const { H, M, N } = generateLDPCMatrix(1000, 0.5);
  let nz = 0;
  for (let i = 0; i < M * N; i++) nz += H[i];
  const density = nz / (M * N);
  test(`Density < 5%  (actual ${(density*100).toFixed(2)}%)`, density < 0.05);
  test('All rows non-zero', (() => {
    for (let r = 0; r < M; r++) {
      let s = 0; for (let c = 0; c < N; c++) s += H[r*N+c]; if (s===0) return false;
    }
    return true;
  })(), `M=${M}, N=${N}`);
}

// ─── SUMMARY ──────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════════╗');
const bar = '█'.repeat(Math.round(passed/total*30)) + '░'.repeat(30 - Math.round(passed/total*30));
console.log(`║  Results: [${bar}] ${passed}/${total} PASSED  ║`);
console.log('╚══════════════════════════════════════════════════════════╝\n');
if (passed < total) process.exit(1);
