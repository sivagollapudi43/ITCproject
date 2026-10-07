/**
 * LDPC Channel Coding Simulation Engine
 * Performance Analysis of LDPC Channel Coding over a Wired Communication Channel
 * 
 * Implements:
 *  - Random binary source generation
 *  - Gallager-style LDPC parity-check matrix generation
 *  - Systematic LDPC encoding via GF(2) row reduction
 *  - Lossless wired channel model (y = c)
 *  - Binary Symmetric Channel (BSC) with bit-flip probability p
 *  - Belief Propagation (Sum-Product) LDPC decoder
 *  - BER calculation (raw channel BER and post-LDPC BER)
 */

// ─────────────────────────────────────────────────────────────
// SECTION 1: INFORMATION SOURCE
// ─────────────────────────────────────────────────────────────

/**
 * Generate a random binary information vector of length K.
 * u_i ∈ {0, 1}
 */
export function generateSource(K) {
  const u = new Uint8Array(K);
  for (let i = 0; i < K; i++) {
    u[i] = Math.random() < 0.5 ? 0 : 1;
  }
  return u;
}

/**
 * Summarise the source vector.
 */
export function describeSource(u) {
  const K = u.length;
  let ones = 0;
  for (let i = 0; i < K; i++) ones += u[i];
  return {
    K,
    ones,
    zeros: K - ones,
    preview: Array.from(u.slice(0, 100)).join(''),
  };
}

// ─────────────────────────────────────────────────────────────
// SECTION 2: GF(2) UTILITIES
// ─────────────────────────────────────────────────────────────

/** Dot product in GF(2) between two Uint8Array vectors. */
function gf2Dot(a, b, len) {
  let s = 0;
  for (let i = 0; i < len; i++) s ^= (a[i] & b[i]);
  return s;
}

/** In-place XOR of row `src` into row `dst` (both of length len). */
function xorRow(dst, src, len) {
  for (let i = 0; i < len; i++) dst[i] ^= src[i];
}

/**
 * Systematic row reduction of a GF(2) matrix in-place.
 * Returns the list of pivot column indices (one per row after reduction).
 * The matrix is stored as a flat Uint8Array of shape (rows × cols).
 */
function gf2RowReduce(mat, rows, cols) {
  const pivotCols = [];
  let pivotRow = 0;
  for (let col = 0; col < cols && pivotRow < rows; col++) {
    // Find a row with a 1 in this column at or below pivotRow
    let found = -1;
    for (let r = pivotRow; r < rows; r++) {
      if (mat[r * cols + col] === 1) { found = r; break; }
    }
    if (found === -1) continue;
    // Swap
    if (found !== pivotRow) {
      for (let c = 0; c < cols; c++) {
        const tmp = mat[pivotRow * cols + c];
        mat[pivotRow * cols + c] = mat[found * cols + c];
        mat[found * cols + c] = tmp;
      }
    }
    pivotCols.push(col);
    // Eliminate all other rows
    for (let r = 0; r < rows; r++) {
      if (r !== pivotRow && mat[r * cols + col] === 1) {
        for (let c = 0; c < cols; c++) {
          mat[r * cols + c] ^= mat[pivotRow * cols + c];
        }
      }
    }
    pivotRow++;
  }
  return pivotCols;
}

// ─────────────────────────────────────────────────────────────
// SECTION 3: LDPC MATRIX GENERATION
// ─────────────────────────────────────────────────────────────

/**
 * Generate a regular LDPC parity-check matrix H of size M × N
 * using a column-weight-3 Gallager-style construction.
 *
 * Strategy:
 *  1. Divide the M rows into groups of M/dv rows (dv = column weight = 3).
 *  2. In the first group, fill columns 0..N-1 with exactly one 1 per dv rows.
 *  3. Permute columns randomly for subsequent groups.
 *
 * Returns a Uint8Array of length M*N (row-major).
 */
export function generateLDPCMatrix(K, rate) {
  // Use small matrices for large K to keep computation feasible
  const maxN = 500;   // cap codeword length for matrix operations
  const N = Math.min(Math.round(K / rate), maxN);
  const M = N - Math.round(N * rate);  // M = N - K_eff
  const K_eff = N - M;

  // Column weight (dv) and row weight (dc)
  const dv = 3;
  const dc = Math.round(dv * N / M);

  const H = new Uint8Array(M * N); // initialised to 0

  // ---- Base sub-matrix: columns spread evenly across rows ----
  // Each column gets exactly one 1 in the first M/dv rows
  const rowsPerGroup = Math.ceil(M / dv);
  for (let col = 0; col < N; col++) {
    const row = col % rowsPerGroup;
    H[row * N + col] = 1;
  }

  // ---- Additional sub-matrices with random column permutations ----
  for (let g = 1; g < dv; g++) {
    const perm = shuffledPermutation(N);
    for (let col = 0; col < N; col++) {
      const srcCol = perm[col];
      const baseRow = (srcCol % rowsPerGroup) + g * rowsPerGroup;
      if (baseRow < M) H[baseRow * N + col] = 1;
    }
  }

  // Remove all-zero rows (can happen at boundaries)
  // and ensure no column is all-zero
  // We do a lightweight fixup
  for (let row = 0; row < M; row++) {
    let rowSum = 0;
    for (let c = 0; c < N; c++) rowSum += H[row * N + c];
    if (rowSum === 0) {
      // Put a 1 in a random column
      const c = Math.floor(Math.random() * N);
      H[row * N + c] = 1;
    }
  }

  return { H, M, N, K_eff, dv, dc: Math.min(dc, N) };
}

function shuffledPermutation(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Matrix statistics */
export function matrixStats(H, M, N) {
  let nonzero = 0;
  for (let i = 0; i < M * N; i++) nonzero += H[i];
  return {
    rows: M,
    cols: N,
    nonzero,
    density: nonzero / (M * N),
  };
}

// ─────────────────────────────────────────────────────────────
// SECTION 4: LDPC SYSTEMATIC ENCODER
// ─────────────────────────────────────────────────────────────

/**
 * Build a systematic generator matrix G from H using GF(2) row reduction.
 *
 * Steps:
 *  1. Row-reduce H to find pivot (parity) columns and free (info) columns.
 *  2. Express parity bits as linear combinations of info bits.
 *  3. G = [I_K | P^T] where P is the parity sub-matrix.
 *
 * Returns { G, infoIdx, parityIdx } where G is K_eff × N.
 */
export function buildGeneratorMatrix(H, M, N) {
  // Work on a copy
  const Hcopy = new Uint8Array(H);
  const pivotCols = gf2RowReduce(Hcopy, M, N);

  const pivotSet = new Set(pivotCols);
  const freeCols = [];
  for (let c = 0; c < N; c++) {
    if (!pivotSet.has(c)) freeCols.push(c);
  }

  const K_eff = freeCols.length;
  // G is K_eff × N
  const G = new Uint8Array(K_eff * N);

  for (let i = 0; i < K_eff; i++) {
    // Info column: set the free column to 1
    G[i * N + freeCols[i]] = 1;
    // Parity columns: read from reduced H rows
    for (let r = 0; r < pivotCols.length; r++) {
      if (Hcopy[r * N + freeCols[i]] === 1) {
        G[i * N + pivotCols[r]] = 1;
      }
    }
  }

  return { G, K_eff, infoIdx: freeCols, parityIdx: pivotCols };
}

/**
 * Encode information vector u (length K_eff) using generator matrix G.
 * c = u · G  mod 2
 * Returns codeword c of length N.
 */
export function encode(u, G, K_eff, N) {
  const c = new Uint8Array(N);
  for (let col = 0; col < N; col++) {
    let val = 0;
    for (let k = 0; k < K_eff; k++) {
      val ^= u[k] & G[k * N + col];
    }
    c[col] = val;
  }
  return c;
}

/**
 * Compute syndrome s = H · c^T  mod 2
 * Returns Uint8Array of length M.
 */
export function computeSyndrome(H, c, M, N) {
  const s = new Uint8Array(M);
  for (let row = 0; row < M; row++) {
    let val = 0;
    for (let col = 0; col < N; col++) {
      val ^= H[row * N + col] & c[col];
    }
    s[row] = val;
  }
  return s;
}

/** Check if syndrome is all zeros */
export function syndromeIsZero(s) {
  for (let i = 0; i < s.length; i++) if (s[i] !== 0) return false;
  return true;
}

/** Count number of 1s in syndrome */
export function syndromeWeight(s) {
  let w = 0;
  for (let i = 0; i < s.length; i++) w += s[i];
  return w;
}

// ─────────────────────────────────────────────────────────────
// SECTION 5: CHANNEL MODELS
// ─────────────────────────────────────────────────────────────

/**
 * Lossless Wired Channel: y = c
 * Mathematical model: P(Y=0|X=0)=1, P(Y=1|X=1)=1
 */
export function losslessChannel(c) {
  return new Uint8Array(c); // perfect copy
}

/**
 * Binary Symmetric Channel (BSC):
 * y_i = c_i XOR z_i,  z_i ~ Bernoulli(p)
 * Transition matrix: [[1-p, p], [p, 1-p]]
 */
export function bscChannel(c, p) {
  const y = new Uint8Array(c.length);
  for (let i = 0; i < c.length; i++) {
    const z = Math.random() < p ? 1 : 0;
    y[i] = c[i] ^ z;
  }
  return y;
}

/**
 * Count bit errors between two binary arrays.
 */
export function countErrors(a, b, len) {
  let errors = 0;
  for (let i = 0; i < len; i++) errors += a[i] ^ b[i];
  return errors;
}

/**
 * Calculate BER.
 */
export function calcBER(errors, total) {
  if (total === 0) return 0;
  return errors / total;
}

// ─────────────────────────────────────────────────────────────
// SECTION 6: LDPC BELIEF PROPAGATION DECODER
// ─────────────────────────────────────────────────────────────

/**
 * Precompute adjacency lists for the Tanner graph.
 *  - checkToVar[row]  = list of column indices where H[row][col] = 1
 *  - varToCheck[col]  = list of row indices where H[row][col] = 1
 */
function buildTannerGraph(H, M, N) {
  const checkToVar = Array.from({ length: M }, () => []);
  const varToCheck = Array.from({ length: N }, () => []);
  for (let row = 0; row < M; row++) {
    for (let col = 0; col < N; col++) {
      if (H[row * N + col] === 1) {
        checkToVar[row].push(col);
        varToCheck[col].push(row);
      }
    }
  }
  return { checkToVar, varToCheck };
}

/**
 * Belief Propagation (Sum-Product) LDPC Decoder.
 *
 * Hard-decision BP on binary received word y.
 * Uses log-likelihood ratios for soft values:
 *   LLR_i = log(P(y_i|c_i=0) / P(y_i|c_i=1))
 *
 * For BSC with flip probability p:
 *   LLR = +log((1-p)/p) if y_i = 0
 *   LLR = -log((1-p)/p) if y_i = 1
 *
 * When p = 0 (lossless), we use a large LLR to represent certainty.
 *
 * @param {Uint8Array} y  - received word (length N)
 * @param {Uint8Array} H  - parity-check matrix M×N
 * @param {number} M
 * @param {number} N
 * @param {number} p      - BSC flip probability (0 for lossless)
 * @param {number} maxIter
 * @returns {{ decoded, iterations, syndromeInit, syndromeFinal, converged }}
 */
export function beliefPropagationDecode(y, H, M, N, p, maxIter) {
  const { checkToVar, varToCheck } = buildTannerGraph(H, M, N);

  // Channel LLR: large value for lossless (p ≈ 0)
  const channelLLR = p < 1e-12
    ? 20.0   // very high confidence (lossless)
    : Math.log((1 - p) / Math.max(p, 1e-12));

  // Initial variable-node LLRs from channel
  const varLLR = new Float64Array(N);
  for (let col = 0; col < N; col++) {
    varLLR[col] = y[col] === 0 ? channelLLR : -channelLLR;
  }

  // Messages: check→var and var→check
  // Index as [checkIdx][posInCheckToVar]
  const msgCV = checkToVar.map(vars => new Float64Array(vars.length)); // check→var
  const msgVC = varToCheck.map(checks => new Float64Array(checks.length)); // var→check

  // Initial syndrome
  const synInit = computeSyndrome(H, y, M, N);
  const synInitWeight = syndromeWeight(synInit);

  // For p=0 (lossless), syndrome should already be 0 if H is valid.
  // Just decode trivially.
  if (p < 1e-12 && syndromeIsZero(synInit)) {
    return {
      decoded: new Uint8Array(y),
      iterations: 0,
      syndromeInit: synInit,
      syndromeFinal: synInit,
      converged: true,
    };
  }

  let iterations = 0;
  let currentEstimate = new Uint8Array(y);

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;

    // ---- Variable → Check messages ----
    for (let col = 0; col < N; col++) {
      const checks = varToCheck[col];
      for (let ci = 0; ci < checks.length; ci++) {
        const checkIdx = checks[ci];
        // Sum all incoming check→var messages EXCEPT the one from checkIdx
        let sum = varLLR[col];
        for (let cj = 0; cj < checks.length; cj++) {
          if (cj !== ci) {
            const otherCheck = checks[cj];
            const posInOtherCheck = checkToVar[otherCheck].indexOf(col);
            sum += msgCV[otherCheck][posInOtherCheck];
          }
        }
        msgVC[col][ci] = sum;
      }
    }

    // ---- Check → Variable messages (min-sum approximation) ----
    for (let row = 0; row < M; row++) {
      const vars = checkToVar[row];
      const nc = vars.length;

      // Compute product of signs and min of |LLR| excluding each var
      // min-sum: R_{r→c} = (∏_{c'≠c} sign(Q_{c'→r})) * min_{c'≠c}|Q_{c'→r}|

      // Gather var→check messages into this check node
      const incoming = new Float64Array(nc);
      for (let vi = 0; vi < nc; vi++) {
        const col = vars[vi];
        const posInVar = varToCheck[col].indexOf(row);
        incoming[vi] = msgVC[col][posInVar];
      }

      // Total sign and global min, second min
      let totalSign = 1;
      let min1 = Infinity, min2 = Infinity;
      let minIdx = -1;
      const signs = new Int8Array(nc);
      for (let vi = 0; vi < nc; vi++) {
        signs[vi] = incoming[vi] >= 0 ? 1 : -1;
        totalSign *= signs[vi];
        const absV = Math.abs(incoming[vi]);
        if (absV < min1) { min2 = min1; min1 = absV; minIdx = vi; }
        else if (absV < min2) min2 = absV;
      }

      for (let vi = 0; vi < nc; vi++) {
        const sign = totalSign * signs[vi]; // exclude vi's sign
        const mag = (vi === minIdx) ? min2 : min1;
        msgCV[row][vi] = sign * mag;
      }
    }

    // ---- Total LLR for each variable ----
    const totalLLR = new Float64Array(N);
    for (let col = 0; col < N; col++) {
      totalLLR[col] = varLLR[col];
      const checks = varToCheck[col];
      for (let ci = 0; ci < checks.length; ci++) {
        const checkIdx = checks[ci];
        const posInCheck = checkToVar[checkIdx].indexOf(col);
        totalLLR[col] += msgCV[checkIdx][posInCheck];
      }
    }

    // ---- Hard decision ----
    for (let col = 0; col < N; col++) {
      currentEstimate[col] = totalLLR[col] >= 0 ? 0 : 1;
    }

    // ---- Check syndrome ----
    const syn = computeSyndrome(H, currentEstimate, M, N);
    if (syndromeIsZero(syn)) {
      return {
        decoded: currentEstimate,
        iterations,
        syndromeInit: synInit,
        syndromeFinal: syn,
        converged: true,
      };
    }
  }

  // Did not converge
  const syndromeFinal = computeSyndrome(H, currentEstimate, M, N);
  return {
    decoded: currentEstimate,
    iterations,
    syndromeInit: synInit,
    syndromeFinal,
    converged: false,
  };
}

// ─────────────────────────────────────────────────────────────
// SECTION 7: INFORMATION RECOVERY
// ─────────────────────────────────────────────────────────────

/**
 * Recover information bits from systematic codeword.
 * For systematic codes, info bits occupy the free (non-pivot) column positions.
 */
export function recoverInfo(decoded, infoIdx, K_eff) {
  const uHat = new Uint8Array(K_eff);
  for (let i = 0; i < K_eff; i++) {
    uHat[i] = decoded[infoIdx[i]];
  }
  return uHat;
}

// ─────────────────────────────────────────────────────────────
// SECTION 8: FULL SIMULATION PIPELINE
// ─────────────────────────────────────────────────────────────

/**
 * Run the full LDPC simulation pipeline.
 *
 * @param {object} params
 *   K          - number of information bits (user requested)
 *   rate       - code rate (e.g., 0.5)
 *   channelMode - 'lossless' | 'bsc'
 *   p          - BSC flip probability
 *   maxIter    - max BP iterations
 *   existingMatrix - if provided, reuse H, G, infoIdx (for consistency)
 */
export function runSimulation(params) {
  const { K, rate, channelMode, p, maxIter, existingMatrix } = params;

  // --- Step 1: Source ---
  // Limit K to K_eff from matrix if matrix exists
  let matrixData;
  if (existingMatrix) {
    matrixData = existingMatrix;
  } else {
    const { H, M, N, K_eff } = generateLDPCMatrix(K, rate);
    const { G, infoIdx, parityIdx } = buildGeneratorMatrix(H, M, N);
    matrixData = { H, M, N, K_eff, G, infoIdx, parityIdx };
  }

  const { H, M, N, K_eff, G, infoIdx } = matrixData;

  // Generate source of length K_eff
  const u = generateSource(K_eff);

  // --- Step 2: Encode ---
  const c = encode(u, G, K_eff, N);

  // --- Step 3: Parity check ---
  const synEnc = computeSyndrome(H, c, M, N);
  const encValid = syndromeIsZero(synEnc);

  // --- Step 4: Channel transmission ---
  const actualP = channelMode === 'lossless' ? 0 : p;
  const y = channelMode === 'lossless' ? losslessChannel(c) : bscChannel(c, p);

  // --- Step 5: Raw BER ---
  const channelErrors = countErrors(c, y, N);
  const rawBER = calcBER(channelErrors, N);

  // --- Step 6: Decode ---
  const { decoded, iterations, syndromeInit, syndromeFinal, converged } =
    beliefPropagationDecode(y, H, M, N, actualP, maxIter);

  // --- Step 7: Recover information ---
  const uHat = recoverInfo(decoded, infoIdx, K_eff);

  // --- Step 8: Final BER ---
  const infoErrors = countErrors(u, uHat, K_eff);
  const ldpcBER = calcBER(infoErrors, K_eff);

  const correctedErrors = Math.max(0, channelErrors - infoErrors);

  return {
    // Source
    u,
    K_eff,
    // Codeword
    c,
    N,
    M,
    rate: K_eff / N,
    // Channel
    channelMode,
    p: actualP,
    y,
    // BER
    channelErrors,
    rawBER,
    // Decoder
    decoded,
    uHat,
    iterations,
    syndromeInit,
    syndromeFinal,
    converged,
    synInitWeight: syndromeWeight(syndromeInit),
    synFinalWeight: syndromeWeight(syndromeFinal),
    // Final BER
    infoErrors,
    ldpcBER,
    correctedErrors,
    // Validation
    encValid,
    // Matrix reference
    matrixData,
  };
}

/**
 * Run performance analysis across multiple noise probabilities.
 * Returns an array of results, one per noise level.
 */
export function runPerformanceAnalysis(K, rate, maxIter, noiseProbs, onProgress) {
  const results = [];

  // Build matrix once
  const { H, M, N, K_eff } = generateLDPCMatrix(K, rate);
  const { G, infoIdx, parityIdx } = buildGeneratorMatrix(H, M, N);
  const matrixData = { H, M, N, K_eff, G, infoIdx, parityIdx };

  for (let i = 0; i < noiseProbs.length; i++) {
    const np = noiseProbs[i];
    const mode = np === 0 ? 'lossless' : 'bsc';
    const res = runSimulation({ K, rate, channelMode: mode, p: np, maxIter, existingMatrix: matrixData });
    results.push({
      p: np,
      rawBER: res.rawBER,
      ldpcBER: res.ldpcBER,
      correctedErrors: res.correctedErrors,
      iterations: res.iterations,
      channelErrors: res.channelErrors,
      infoErrors: res.infoErrors,
      converged: res.converged,
    });
    if (onProgress) onProgress(i + 1, noiseProbs.length);
  }
  return results;
}

/**
 * Run validation tests.
 */
export function runValidationTests(matrixData, simResultLossless, simResultBSC, p) {
  const { H, M, N, K_eff } = matrixData;
  const results = [];

  // TEST 1: Hc^T = 0 for encoded codeword
  {
    const syn = computeSyndrome(H, simResultLossless.c, M, N);
    results.push({
      id: 1,
      name: 'Hc^T = 0 (Encoding Validity)',
      description: 'Verify the encoded codeword satisfies all parity-check equations.',
      pass: syndromeIsZero(syn),
      detail: `Syndrome weight: ${syndromeWeight(syn)}`,
    });
  }

  // TEST 2: Lossless channel y = c
  {
    let match = true;
    for (let i = 0; i < N; i++) {
      if (simResultLossless.c[i] !== simResultLossless.y[i]) { match = false; break; }
    }
    results.push({
      id: 2,
      name: 'Lossless Channel: y = c',
      description: 'Verify received word equals transmitted codeword in lossless mode.',
      pass: match,
      detail: match ? 'No bit changes detected' : 'Bit mismatch found!',
    });
  }

  // TEST 3: Hy^T = 0 for lossless channel
  {
    const syn = computeSyndrome(H, simResultLossless.y, M, N);
    results.push({
      id: 3,
      name: 'Hy^T = 0 (Lossless Syndrome)',
      description: 'Syndrome of received word is zero in lossless channel.',
      pass: syndromeIsZero(syn),
      detail: `Syndrome weight: ${syndromeWeight(syn)}`,
    });
  }

  // TEST 4: u_hat = u (lossless recovery)
  {
    const match = syndromeIsZero(
      computeSyndrome(
        new Uint8Array(simResultLossless.u.map((v, i) => v ^ simResultLossless.uHat[i])),
        new Uint8Array(K_eff).fill(0), K_eff, 1
      )
    );
    let same = true;
    for (let i = 0; i < K_eff; i++) {
      if (simResultLossless.u[i] !== simResultLossless.uHat[i]) { same = false; break; }
    }
    results.push({
      id: 4,
      name: 'û = u (Lossless Recovery)',
      description: 'Recovered information matches original in lossless mode.',
      pass: same,
      detail: same ? 'All info bits recovered correctly' : `${simResultLossless.infoErrors} info bit errors`,
    });
  }

  // TEST 5: Lossless BER = 0
  {
    results.push({
      id: 5,
      name: 'Lossless BER = 0',
      description: 'BER must be exactly zero in lossless channel.',
      pass: simResultLossless.rawBER === 0 && simResultLossless.ldpcBER === 0,
      detail: `Raw BER: ${simResultLossless.rawBER}, LDPC BER: ${simResultLossless.ldpcBER}`,
    });
  }

  // TEST 6: BSC raw BER ≈ p
  if (simResultBSC && p > 0) {
    const tol = Math.max(0.01, 3 * Math.sqrt(p * (1 - p) / N));
    const rawBERCloseToP = Math.abs(simResultBSC.rawBER - p) < tol;
    results.push({
      id: 6,
      name: `BSC Raw BER ≈ p=${p}`,
      description: `Raw channel BER should approximate the BSC flip probability p (±${tol.toFixed(4)} tolerance for N=${N}).`,
      pass: rawBERCloseToP,
      detail: `Raw BER = ${simResultBSC.rawBER.toFixed(6)}, p = ${p}, |diff| = ${Math.abs(simResultBSC.rawBER - p).toFixed(6)}`,
    });
  }

  // TEST 7: LDPC BER ≤ raw BER (for low noise)
  if (simResultBSC && p > 0 && p <= 0.05) {
    results.push({
      id: 7,
      name: 'LDPC BER ≤ Raw BER',
      description: 'LDPC decoder should generally reduce BER at low noise levels.',
      pass: simResultBSC.ldpcBER <= simResultBSC.rawBER + 1e-9,
      detail: `LDPC BER = ${simResultBSC.ldpcBER.toFixed(6)}, Raw BER = ${simResultBSC.rawBER.toFixed(6)}`,
    });
  }

  return results;
}
