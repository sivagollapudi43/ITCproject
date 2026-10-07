import React from 'react';

export default function TheoryPage() {
  return (
    <div>
      <div className="page-header">
        <h1>📚 Theory</h1>
        <p>Conceptual background for B.Tech students — Information Theory and Channel Coding</p>
      </div>
      <div className="page-body">

        <Section title="What is Channel Coding?">
          <p>
            Channel coding (also called error-control coding) is a technique used to add redundant bits to the
            transmitted data so that the receiver can detect and/or correct errors introduced by the
            communication channel. Without channel coding, even a single bit flip caused by noise can corrupt
            the information.
          </p>
          <p>
            A channel encoder takes a block of <span className="inline-math">K</span> information bits and
            produces a longer codeword of <span className="inline-math">N &gt; K</span> bits. The extra{' '}
            <span className="inline-math">N - K</span> bits are called parity bits and carry redundancy.
          </p>
        </Section>

        <Section title="Why is Channel Coding Needed?">
          <p>
            In any real communication system — wired or wireless — imperfections such as thermal noise, electromagnetic
            interference, or hardware imperfections can randomly flip bits. In a <strong>lossless wired channel</strong>,
            there is no noise by definition, so BER = 0 without any coding. However, in practice, even
            wired channels can experience controlled or intentional perturbations.
          </p>
          <p>
            Channel coding is needed to:
          </p>
          <ul>
            <li>Achieve reliable communication over noisy channels</li>
            <li>Reduce the bit error rate (BER) below an acceptable threshold</li>
            <li>Approach the Shannon channel capacity limit</li>
            <li>Enable error detection and correction without retransmission</li>
          </ul>
        </Section>

        <Section title="What is LDPC?">
          <p>
            LDPC stands for <strong>Low-Density Parity-Check</strong> codes. They were invented by Robert Gallager
            in 1960 and rediscovered by MacKay and Neal in 1996. LDPC codes are linear block codes defined by
            a sparse parity-check matrix <span className="inline-math">H</span>.
          </p>
          <p>
            LDPC codes are used in modern communication standards such as:
          </p>
          <ul>
            <li>5G NR (New Radio)</li>
            <li>Wi-Fi 802.11n/ac/ax</li>
            <li>DVB-S2 (satellite television)</li>
            <li>10GBase-T Ethernet</li>
          </ul>
          <p>
            LDPC codes can achieve performance very close to the theoretical Shannon limit, making them
            far superior to older techniques like Hamming codes or CRC.
          </p>
        </Section>

        <Section title="Why is LDPC Called 'Low-Density'?">
          <p>
            The parity-check matrix <span className="inline-math">H</span> of an LDPC code is sparse — it contains
            far fewer 1s than 0s. In a regular LDPC code:
          </p>
          <ul>
            <li>Each column has exactly <span className="inline-math">d_v</span> ones (variable-node degree)</li>
            <li>Each row has exactly <span className="inline-math">d_c</span> ones (check-node degree)</li>
          </ul>
          <p>
            The density of H is approximately <span className="inline-math">d_v / M</span>, which is very small
            (typically &lt; 5%). This sparsity enables efficient iterative decoding algorithms like Belief Propagation.
          </p>
        </Section>

        <Section title="What is a Parity-Check Matrix?">
          <p>
            The parity-check matrix <span className="inline-math">H ∈ GF(2)^(M×N)</span> defines all the
            parity constraints that a valid codeword must satisfy. A binary vector{' '}
            <span className="inline-math">c</span> of length <span className="inline-math">N</span> is a valid
            codeword if and only if:
          </p>
          <div className="math-block">H · c^T = 0 (mod 2)</div>
          <p>
            This means every row of H applied to the codeword gives 0. Each row represents one parity-check equation.
            There are <span className="inline-math">M = N - K</span> such equations.
          </p>
        </Section>

        <Section title="What is a Codeword?">
          <p>
            A codeword <span className="inline-math">c</span> of length <span className="inline-math">N</span> is
            the output of the LDPC encoder given information bits <span className="inline-math">u</span> of
            length <span className="inline-math">K</span>. In systematic coding:
          </p>
          <div className="math-block">c = [u | p]</div>
          <p>
            where <span className="inline-math">u</span> is the information part and{' '}
            <span className="inline-math">p</span> is the parity part. Every codeword satisfies{' '}
            <span className="inline-math">Hc^T = 0</span>.
          </p>
          <p>
            Encoding is performed as: <span className="inline-math">c = u · G mod 2</span>, where{' '}
            <span className="inline-math">G</span> is the generator matrix derived from <span className="inline-math">H</span>.
          </p>
        </Section>

        <Section title="What is Code Rate?">
          <p>
            Code rate <span className="inline-math">R</span> is the ratio of information bits to total codeword bits:
          </p>
          <div className="math-block">R = K / N</div>
          <p>
            A code rate of R = 1/2 means half the bits are information and half are parity. Higher code rate means
            less redundancy and less error-correction capability. Lower code rate means more redundancy and more
            error-correction capability, but lower spectral efficiency.
          </p>
        </Section>

        <Section title="What is a Lossless Channel?">
          <p>
            A <strong>lossless wired channel</strong> is an ideal channel where no bit errors occur during transmission.
            The mathematical model is:
          </p>
          <div className="math-block">y = c</div>
          <p>
            The channel transition matrix is:
          </p>
          <div className="math-block">
            P = [[1, 0],<br />
            {'     '}[0, 1]]
          </div>
          <p>
            Meaning: <span className="inline-math">P(Y=0|X=0) = 1</span> and{' '}
            <span className="inline-math">P(Y=1|X=1) = 1</span>. No bit can ever flip.
            In this case, <strong>BER = 0 exactly</strong>, and LDPC has no errors to correct.
          </p>
          <div className="alert alert-success">
            The lossless wired channel is the baseline for this experiment. It shows that the LDPC system
            works correctly with BER = 0 before introducing noise.
          </div>
        </Section>

        <Section title="What is a Binary Symmetric Channel (BSC)?">
          <p>
            A Binary Symmetric Channel (BSC) is a simplified noise model where each transmitted bit is
            independently flipped with probability <span className="inline-math">p</span>:
          </p>
          <div className="math-block">y_i = c_i XOR z_i,  where z_i ~ Bernoulli(p)</div>
          <p>
            The transition matrix is:
          </p>
          <div className="math-block">
            P = [[1-p,  p ],<br />
            {'     '}[ p,  1-p]]
          </div>
          <p>
            When p = 0, BSC becomes the lossless channel. When p = 0.5, it is a completely random channel
            (useless). In our experiment, we use small p values (0.001 to 0.10) to study LDPC correction capability.
          </p>
          <div className="alert alert-warning">
            The BSC is used only for the controlled-noise experiment. This is NOT the primary channel.
            The primary channel is the lossless wired channel.
          </div>
        </Section>

        <Section title="What is Syndrome?">
          <p>
            The syndrome <span className="inline-math">s</span> is calculated at the receiver to detect errors:
          </p>
          <div className="math-block">s = H · y^T (mod 2)</div>
          <p>
            If <span className="inline-math">s = 0</span>, the received word satisfies all parity-check equations
            (no detectable errors). If <span className="inline-math">s ≠ 0</span>, errors are present.
            The number of non-zero elements in <span className="inline-math">s</span> is called the syndrome weight,
            and it indicates how many parity checks have been violated.
          </p>
        </Section>

        <Section title="What is Belief Propagation?">
          <p>
            Belief Propagation (BP), also called the Sum-Product Algorithm, is the iterative message-passing
            decoder used for LDPC codes. It operates on the Tanner graph, which has:
          </p>
          <ul>
            <li><strong>Variable nodes</strong>: one per codeword bit (N nodes)</li>
            <li><strong>Check nodes</strong>: one per parity-check equation (M nodes)</li>
            <li><strong>Edges</strong>: connecting variable node j to check node i if H[i][j] = 1</li>
          </ul>
          <p>
            In each iteration:
          </p>
          <ul>
            <li>Variable nodes send soft messages (log-likelihood ratios) to neighboring check nodes</li>
            <li>Check nodes process these messages and reply back</li>
            <li>Variable nodes update their beliefs and make hard decisions</li>
          </ul>
          <p>
            The algorithm converges when all syndrome checks are satisfied, or stops after a maximum number of iterations.
            This simulation uses the <strong>Min-Sum approximation</strong> of BP for computational efficiency.
          </p>
        </Section>

        <Section title="What is BER?">
          <p>
            Bit Error Rate (BER) is the fraction of bits received incorrectly:
          </p>
          <div className="math-block">BER = Number of incorrect bits / Total number of bits</div>
          <p>
            Two types of BER are calculated:
          </p>
          <ul>
            <li><strong>Raw Channel BER</strong>: Compares transmitted codeword c with received word y. Approximately equals p for BSC.</li>
            <li><strong>Post-LDPC BER</strong>: Compares original info bits u with recovered info bits û. This should be lower than raw BER after successful decoding.</li>
          </ul>
        </Section>

        <Section title="Why Does BER = 0 in a Lossless Channel?">
          <p>
            In a lossless channel, y = c exactly. Therefore, no bit is flipped, and the number of incorrect bits is zero.
            BER = 0 / N = 0. This is guaranteed by the mathematical model of the lossless channel,
            not by LDPC correction. LDPC has no errors to correct in this case.
          </p>
        </Section>

        <Section title="Why Does Adding Noise Make BER Non-Zero?">
          <p>
            When using the BSC with flip probability p &gt; 0, each bit independently flips with probability p.
            For N transmitted bits, approximately p × N bits will be flipped on average (by the law of large numbers).
            Raw BER ≈ p for large N.
          </p>
        </Section>

        <Section title="Why Does LDPC Reduce BER?">
          <p>
            LDPC reduces BER by using the redundancy in the parity bits. The decoder knows that valid codewords
            satisfy Hc^T = 0. When errors occur, this constraint is violated. The decoder uses the Tanner graph
            to iteratively find the most likely codeword that satisfies all constraints.
          </p>
          <p>
            For low to moderate noise levels (within the correction capability of the code), LDPC decoding
            produces a decoded word with far fewer errors than the raw received word. This is the "coding gain."
            At very high noise levels, the decoder may fail (not converge), and LDPC cannot help further.
          </p>
        </Section>

      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="theory-section">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
