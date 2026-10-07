# Performance Analysis of LDPC Channel Coding over a Wired Communication Channel

**Information Theory and Coding (ITC) — Academic Project**  
**Registration: EVEN → Wired Communication Channel**

---

## Project Overview

This is a complete, interactive web-based simulation that demonstrates **LDPC (Low-Density Parity-Check) channel coding** over a **wired communication channel**.

The project implements the full LDPC pipeline:

```
Information Source
      ↓
LDPC Encoder  (c = u·G mod 2)
      ↓
Wired Channel  (Lossless: y=c  |  BSC noise: y=c⊕z)
      ↓
LDPC Decoder  (Belief Propagation / Min-Sum)
      ↓
Recovered Information  (û = first K bits)
      ↓
BER Calculation  (Raw BER + Post-LDPC BER)
      ↓
Performance Analysis  (BER vs Noise Probability graph)
```

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend Framework | React 18 + Vite |
| Language | JavaScript (ES2022) |
| Charts | Recharts |
| Styling | Vanilla CSS (custom dark theme) |
| Backend | None — fully frontend simulation |

---

## How to Run

### Prerequisites

- Node.js ≥ 18.0
- npm ≥ 9.0

### Installation

```bash
# Clone or extract the project
cd ITC_project

# Install dependencies
npm install

# Start development server
npm run dev
```

Open your browser at: **http://localhost:5173**

### Production Build

```bash
npm run build
npm run preview
```

---

## Project Architecture

```
ITC_project/
├── index.html                   # HTML entry point
├── package.json
├── vite.config.js
├── test_ldpc.mjs               # Node.js standalone tests (run: node test_ldpc.mjs)
│
└── src/
    ├── main.jsx                 # React entry point
    ├── App.jsx                  # Root component + navigation state
    ├── index.css                # Global CSS (dark research dashboard theme)
    │
    ├── core/
    │   └── ldpc.js              # ⭐ CORE SIMULATION ENGINE (all math here)
    │
    ├── components/
    │   └── Sidebar.jsx          # Navigation sidebar
    │
    └── pages/
        ├── HomePage.jsx         # Home + block diagram
        ├── TheoryPage.jsx       # Theory explanations
        ├── SystemModelPage.jsx  # Block diagram + H matrix visualization
        ├── MathModelPage.jsx    # Mathematical formulations
        ├── SimulationPage.jsx   # ⭐ Main simulation dashboard
        ├── PerformancePage.jsx  # ⭐ BER performance analysis + charts
        └── ValidationPage.jsx  # ⭐ Automated test suite (7 tests)
```

### Key File: `src/core/ldpc.js`

This is the mathematical heart of the project. All functions here produce **real simulation values** — no hardcoding, no fake results.

| Function | Purpose |
|----------|---------|
| `generateSource(K)` | Random binary i.i.d. source |
| `generateLDPCMatrix(K, rate)` | Gallager-style LDPC H matrix |
| `buildGeneratorMatrix(H, M, N)` | GF(2) row reduction → systematic G |
| `encode(u, G, K_eff, N)` | `c = u·G mod 2` |
| `computeSyndrome(H, c, M, N)` | `s = H·c^T mod 2` |
| `losslessChannel(c)` | `y = c` (no errors) |
| `bscChannel(c, p)` | `y_i = c_i XOR z_i`, `z_i ~ Bernoulli(p)` |
| `beliefPropagationDecode(...)` | Min-Sum BP decoder on Tanner graph |
| `recoverInfo(decoded, infoIdx)` | Extract info bits from systematic codeword |
| `runSimulation(params)` | Full pipeline: source → encode → channel → decode → BER |
| `runPerformanceAnalysis(...)` | Multi-noise-level BER sweep |
| `runValidationTests(...)` | 7 automated mathematical property tests |

---

## Navigation Pages

| Page | Description |
|------|-------------|
| **Home** | Project overview, pipeline diagram |
| **Theory** | B.Tech-level explanations of LDPC, channels, BER |
| **System Model** | Block diagram, channel transition matrices, H matrix heatmap |
| **Math Model** | Full mathematical formulation of every component |
| **Simulation** | Step-by-step interactive simulation (5 steps) |
| **Performance** | BER vs p graph across all noise levels |
| **Validation Tests** | 7 automated verification tests |

---

## Academic Context

### Assignment Requirements (EVEN Registration)

- **Primary Channel:** Lossless Wired Channel (y = c)
- **Channel Coding:** LDPC (NOT Hamming, NOT CRC)
- **Noise Model:** Binary Symmetric Channel (BSC) for performance experiment

### Channels Used

| Channel | Model | BER |
|---------|-------|-----|
| Lossless Wired (BASELINE) | y = c | 0 |
| BSC (p=0.001) | y_i = c_i ⊕ z_i | ≈ 0.001 |
| BSC (p=0.01) | y_i = c_i ⊕ z_i | ≈ 0.01 |
| BSC (p=0.10) | y_i = c_i ⊕ z_i | ≈ 0.10 |

> **Important:** The lossless channel gives BER = 0 because no noise is introduced.
> LDPC has nothing to correct in the lossless baseline.
> The BSC experiment demonstrates LDPC's error-correction capability.

---

## Mathematical Model

### Source
```
u ∈ GF(2)^K,  u_i ~ Bernoulli(0.5)
```

### LDPC Parity-Check Matrix
```
H ∈ GF(2)^(M×N),  M = N-K,  density ≈ 1-5%
```

### Encoding
```
c = u · G  (mod 2),  where HG^T = 0
```

### Lossless Channel
```
y = c  (no errors)
```

### BSC Channel
```
y_i = c_i ⊕ z_i,  z_i ~ Bernoulli(p)
```

### Syndrome
```
s = H · y^T  (mod 2)
s = 0 → no detectable errors
```

### BER
```
Raw BER  = channel_errors / N
LDPC BER = info_errors / K
```

---

## Running Core Logic Tests

The file `test_ldpc.mjs` tests the mathematical core independently (no browser needed):

```bash
node test_ldpc.mjs
```

Expected output:
```
RESULTS: 12/12 tests PASSED
```

Tests verify:
- Hc^T = 0 (encoding validity)
- y = c (lossless channel)
- Hy^T = 0 (lossless syndrome)
- û = u (lossless recovery)
- BER = 0 for lossless
- Raw BER ≈ p for BSC
- Matrix is low-density

---

## What is NOT Used (Per Assignment)

- ❌ Hamming Code
- ❌ CRC
- ❌ Wireless fading channel
- ❌ EGG / Underwater communication
- ❌ AWGN as primary channel (optional only)
- ❌ Fake/hardcoded BER values

---

## Developer Notes

- All BER values are computed from actual simulation runs
- The LDPC H matrix is generated fresh each time (Gallager-style construction)
- For large K (>500), the matrix is capped at N=500 to keep browser-based encoding/decoding feasible
- The Min-Sum variant of Belief Propagation is used for numerical stability
- The decoder converges when syndrome = 0 or max iterations reached
