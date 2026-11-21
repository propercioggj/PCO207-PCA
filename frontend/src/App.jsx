import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// ============================================================================
// PCA Math Engine (Pure JS - no WASM needed)
// ============================================================================
const PCAEngine = {
  // Dados originais das 6 observações (Gene A, Gene B)
  rawData: [
    [11, 8],
    [9, 12],
    [8, 10],
    [1, 3],
    [3, 2],
    [4, 5],
  ],

  mean(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  },

  variance(arr) {
    const m = this.mean(arr);
    return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  },

  centerData(data) {
    const col0 = data.map(r => r[0]);
    const col1 = data.map(r => r[1]);
    const m0 = this.mean(col0);
    const m1 = this.mean(col1);
    return data.map(r => [r[0] - m0, r[1] - m1]);
  },

  // Project point onto line through origin at angle (degrees)
  projectOntoLine(point, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    const dot = point[0] * dx + point[1] * dy;
    return [dot * dx, dot * dy];
  },

  // Signed distance along line direction (scalar projection)
  scalarProjection(point, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return point[0] * Math.cos(rad) + point[1] * Math.sin(rad);
  },

  // Perpendicular distance squared from point to line through origin
  distToLineSquared(point, angleDeg) {
    const proj = this.projectOntoLine(point, angleDeg);
    return (point[0] - proj[0]) ** 2 + (point[1] - proj[1]) ** 2;
  },

  // Sum of squared distances to line
  sumDistSquared(data, angleDeg) {
    return data.reduce((s, p) => s + this.distToLineSquared(p, angleDeg), 0);
  },

  // Sum of squared projection distances to origin
  sumProjSquared(data, angleDeg) {
    return data.reduce((s, p) => s + this.scalarProjection(p, angleDeg) ** 2, 0);
  },

  // Find optimal angle (eigenvector direction) using covariance
  findBestAngle(data) {
    const col0 = data.map(r => r[0]);
    const col1 = data.map(r => r[1]);
    const cov = data.reduce((s, r) => s + r[0] * r[1], 0) / (data.length - 1);
    const v0 = this.variance(col0);
    const v1 = this.variance(col1);

    // Eigenvalue computation via 2x2 covariance matrix
    const a = v0, b = cov, c = cov, d = v1;
    const trace = a + d;
    const det = a * d - b * c;
    const disc = Math.sqrt(trace * trace - 4 * det);
    const lambda1 = (trace + disc) / 2;

    // Eigenvector for lambda1
    let vx, vy;
    if (Math.abs(b) > 1e-10) {
      vx = lambda1 - d;
      vy = b;
    } else if (Math.abs(c) > 1e-10) {
      vx = c;
      vy = lambda1 - a;
    } else {
      vx = 1; vy = 0;
    }
    const angle = (Math.atan2(vy, vx) * 180) / Math.PI;
    return ((angle % 180) + 180) % 180;
  },

  // Rotate data to PCA coordinates
  rotateToPC(data, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return data.map(p => {
      const pc1 = p[0] * cos + p[1] * sin;
      const pc2 = -p[0] * sin + p[1] * cos;
      return [pc1, pc2];
    });
  },
};

// ============================================================================
// SVG Icons (Lucide-style)
// ============================================================================
const Icons = {
  Chart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  Github: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  ),
};

// ============================================================================
// Canvas Chart Component (Scatter Plot with Axes)
// ============================================================================
const ScatterChart = ({ data, xLabel, yLabel, lineAngle, showLine, showProjections, range }) => {
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = rect.width;
    const H = rect.height;
    const pad = { top: 30, right: 30, bottom: 50, left: 60 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    // Auto range or provided
    const r = range || (() => {
      const allX = data.map(d => d[0]);
      const allY = data.map(d => d[1]);
      const mx = Math.max(Math.abs(Math.min(...allX)), Math.abs(Math.max(...allX)), 1);
      const my = Math.max(Math.abs(Math.min(...allY)), Math.abs(Math.max(...allY)), 1);
      const m = Math.ceil(Math.max(mx, my) * 1.3);
      return m;
    })();

    const toX = v => pad.left + ((v + r) / (2 * r)) * plotW;
    const toY = v => pad.top + ((r - v) / (2 * r)) * plotH;

    // Clear
    ctx.fillStyle = '#FFFFFE';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = '#E8EFEE';
    ctx.lineWidth = 0.5;
    const step = r <= 5 ? 1 : r <= 15 ? 2 : 5;
    for (let v = -r; v <= r; v += step) {
      ctx.beginPath(); ctx.moveTo(toX(v), pad.top); ctx.lineTo(toX(v), pad.top + plotH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.left, toY(v)); ctx.lineTo(pad.left + plotW, toY(v)); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = '#203335';
    ctx.lineWidth = 1.5;
    // X axis
    ctx.beginPath(); ctx.moveTo(pad.left, toY(0)); ctx.lineTo(pad.left + plotW, toY(0)); ctx.stroke();
    // Y axis
    ctx.beginPath(); ctx.moveTo(toX(0), pad.top); ctx.lineTo(toX(0), pad.top + plotH); ctx.stroke();

    // Tick marks and labels
    ctx.fillStyle = '#5F7577';
    ctx.font = '12px Source Sans 3, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let v = -r; v <= r; v += step) {
      if (v === 0) continue;
      // X ticks
      ctx.beginPath(); ctx.moveTo(toX(v), toY(0) - 4); ctx.lineTo(toX(v), toY(0) + 4); ctx.stroke();
      ctx.fillText(String(v), toX(v), toY(0) + 8);
      // Y ticks
      ctx.beginPath(); ctx.moveTo(toX(0) - 4, toY(v)); ctx.lineTo(toX(0) + 4, toY(v)); ctx.stroke();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(v), toX(0) - 8, toY(v));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
    }

    // Axis Labels
    ctx.fillStyle = '#203335';
    ctx.font = 'bold 14px Lexend, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(xLabel, pad.left + plotW / 2, H - 16);

    ctx.save();
    ctx.translate(16, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'middle';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Line through origin
    if (showLine && lineAngle !== undefined) {
      const rad = (lineAngle * Math.PI) / 180;
      const len = r * 1.5;
      const x1 = -len * Math.cos(rad), y1 = -len * Math.sin(rad);
      const x2 = len * Math.cos(rad), y2 = len * Math.sin(rad);

      ctx.strokeStyle = '#2A9D8F';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(toX(x1), toY(y1));
      ctx.lineTo(toX(x2), toY(y2));
      ctx.stroke();

      // Projections (dashed lines from point to line)
      if (showProjections) {
        ctx.strokeStyle = '#203335';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        data.forEach(p => {
          const proj = PCAEngine.projectOntoLine(p, lineAngle);
          ctx.beginPath();
          ctx.moveTo(toX(p[0]), toY(p[1]));
          ctx.lineTo(toX(proj[0]), toY(proj[1]));
          ctx.stroke();

          // Projection point (black dot)
          ctx.fillStyle = '#203335';
          ctx.beginPath();
          ctx.arc(toX(proj[0]), toY(proj[1]), 4, 0, 2 * Math.PI);
          ctx.fill();
        });
        ctx.setLineDash([]);
      }
    }

    // Data points
    data.forEach(p => {
      ctx.fillStyle = '#B22222';
      ctx.beginPath();
      ctx.arc(toX(p[0]), toY(p[1]), 5, 0, 2 * Math.PI);
      ctx.fill();
    });
  }, [data, xLabel, yLabel, lineAngle, showLine, showProjections, range]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
};

// ============================================================================
// Main App Component
// ============================================================================
function App() {
  // === State ===
  const [centered, setCentered] = useState(false);
  const [showLine, setShowLine] = useState(false);
  const [angle, setAngle] = useState(30);
  const [useBestAngle, setUseBestAngle] = useState(false);
  const [showPCPlot, setShowPCPlot] = useState(false);

  // === Computed Data ===
  const rawData = PCAEngine.rawData;
  const displayData = centered ? PCAEngine.centerData(rawData) : rawData;
  const colA = displayData.map(r => r[0]);
  const colB = displayData.map(r => r[1]);
  const varA = PCAEngine.variance(colA);
  const varB = PCAEngine.variance(colB);
  const sumVar = varA + varB;
  const pctA = (varA / sumVar) * 100;
  const pctB = (varB / sumVar) * 100;

  const bestAngle = centered ? PCAEngine.findBestAngle(displayData) : 0;
  const effectiveAngle = useBestAngle ? bestAngle : angle;

  // PC Coordinates when rotated
  const pcData = PCAEngine.rotateToPC(displayData, effectiveAngle);
  const pc1Col = pcData.map(r => r[0]);
  const pc2Col = pcData.map(r => r[1]);
  const varPC1 = PCAEngine.variance(pc1Col);
  const varPC2 = PCAEngine.variance(pc2Col);
  const pctPC1 = (varPC1 / sumVar) * 100;
  const pctPC2 = (varPC2 / sumVar) * 100;

  const sumDistSq = centered ? PCAEngine.sumDistSquared(displayData, effectiveAngle) : 0;
  const sumProjSq = centered ? PCAEngine.sumProjSquared(displayData, effectiveAngle) : 0;

  // Chart range
  const getRange = (data) => {
    const all = data.flat();
    const m = Math.ceil(Math.max(...all.map(Math.abs)) * 1.3);
    return Math.max(m, 2);
  };

  // Format number Brazilian style
  const fmt = (n, dec = 2) => {
    if (typeof n !== 'number' || isNaN(n)) return '—';
    return n.toFixed(dec).replace('.', ',');
  };
  const fmtPct = (n) => fmt(n, 2) + '%';

  // Update angle when useBestAngle toggled
  useEffect(() => {
    if (useBestAngle && centered) {
      setAngle(Math.round(bestAngle));
    }
  }, [useBestAngle, centered, bestAngle]);

  // === Step Detection (for progress indicator) ===
  const step = !centered ? 1 : !showLine ? 1 : !useBestAngle ? 2 : showPCPlot ? 4 : 3;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-title">
          <h1>
            <Icons.Chart />
            Entendendo a PCA passo a passo
          </h1>
          <p>Simulador interativo de Análise de Componentes Principais</p>
        </div>
        <span className="badge-mestrado">PCO207 - UNIFEI</span>
      </header>

      <main className="app-content">

        {/* ================================================================
            STEP 1: Conhecendo os dados
            ================================================================ */}
        <section className="glass-card">
          <h2 className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            Conhecendo os dados
          </h2>
          <p className="card-description">
            Começamos com duas variáveis medidas nas mesmas seis observações.
          </p>

          <div className="control-group" style={{ marginBottom: 20, marginTop: 0 }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={centered}
                onChange={(e) => {
                  setCentered(e.target.checked);
                  if (!e.target.checked) {
                    setShowLine(false);
                    setUseBestAngle(false);
                    setShowPCPlot(false);
                  }
                }}
              />
              Centralizar os dados
            </label>
          </div>

          <div className="section-layout">
            {/* Table */}
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: 12, color: '#203335' }}>Base de dados</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Observação</th>
                    <th>Gene A</th>
                    <th>Gene B</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((row, i) => (
                    <tr key={i}>
                      <td className="obs-name">Observação {i + 1}</td>
                      <td>{fmt(row[0])}</td>
                      <td>{fmt(row[1])}</td>
                    </tr>
                  ))}
                  <tr className="variance-row">
                    <td className="obs-name"><strong>Variância</strong></td>
                    <td>{fmt(varA, 4)}</td>
                    <td>{fmt(varB, 4)}</td>
                  </tr>
                  <tr className="pct-row">
                    <td className="obs-name"><strong>% da variância</strong></td>
                    <td>{fmtPct(pctA)}</td>
                    <td>{fmtPct(pctB)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="summary-stat" style={{ marginTop: 16 }}>
                Soma das variâncias: <span>{fmt(sumVar, 4)}</span>
              </p>
            </div>

            {/* Chart */}
            <div className="chart-container">
              <ScatterChart
                data={displayData}
                xLabel="Gene A"
                yLabel="Gene B"
                range={getRange(displayData)}
                showLine={false}
              />
            </div>
          </div>
        </section>

        {/* ================================================================
            STEP 2: Escolhendo uma reta (visible when centered)
            ================================================================ */}
        {centered && (
          <section className="glass-card">
            <h2 className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              Escolhendo uma reta
            </h2>
            <p className="card-description">
              Podemos escolher uma reta qualquer e observar como os pontos se comportam quando projetados sobre ela.
            </p>

            <div className="section-layout">
              {/* Controls */}
              <div>
                <div className="control-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={showLine}
                      onChange={(e) => {
                        setShowLine(e.target.checked);
                        if (!e.target.checked) {
                          setUseBestAngle(false);
                          setShowPCPlot(false);
                        }
                      }}
                    />
                    Inserir reta
                  </label>

                  {showLine && (
                    <>
                      <div className="slider-group">
                        <div className="slider-label">
                          Ângulo da reta: <span className="angle-display">{Math.round(effectiveAngle)}°</span>
                        </div>
                        <div className="slider-marks">
                          <span>0°</span><span>180°</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="180"
                          step="1"
                          value={Math.round(effectiveAngle)}
                          onChange={(e) => {
                            setAngle(Number(e.target.value));
                            setUseBestAngle(false);
                          }}
                          disabled={useBestAngle}
                        />
                        <div className="slider-marks" style={{ fontSize: '0.7rem' }}>
                          {[0, 18, 36, 54, 72, 90, 108, 126, 144, 162, 180].map(v => (
                            <span key={v}>{v}</span>
                          ))}
                        </div>
                      </div>

                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={useBestAngle}
                          onChange={(e) => setUseBestAngle(e.target.checked)}
                        />
                        Usar o melhor ângulo
                      </label>

                      {useBestAngle && (
                        <div className="metric-highlight">
                          Melhor ângulo: <span>{fmt(bestAngle)}°</span>
                        </div>
                      )}

                      <div className="metric-display">
                        <strong>Soma dos quadrados das distâncias até a reta:</strong>{' '}
                        <span>{fmt(sumDistSq, 4)}</span>
                      </div>
                      <div className="metric-display">
                        <strong>Soma dos quadrados das distâncias das projeções até a origem:</strong>{' '}
                        <span>{fmt(sumProjSq, 4)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Chart with line */}
              <div className="chart-container">
                <ScatterChart
                  data={displayData}
                  xLabel="Gene A"
                  yLabel="Gene B"
                  range={getRange(displayData)}
                  showLine={showLine}
                  showProjections={showLine}
                  lineAngle={effectiveAngle}
                />
              </div>
            </div>
          </section>
        )}

        {/* ================================================================
            STEP 3: Rotacionando os eixos
            ================================================================ */}
        {centered && showLine && (
          <section className="glass-card">
            <h2 className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Rotacionando os eixos
            </h2>
            <p className="card-description">
              A reta escolhida define um novo eixo. As coordenadas dos pontos nesse novo sistema são chamadas de PC1 e PC2.
            </p>

            <div className="section-layout">
              {/* PC Coordinates Table */}
              <div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Observação</th>
                      <th>PC1</th>
                      <th>PC2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pcData.map((row, i) => (
                      <tr key={i}>
                        <td className="obs-name">Observação {i + 1}</td>
                        <td>{fmt(row[0], 4)}</td>
                        <td>{fmt(row[1], 4)}</td>
                      </tr>
                    ))}
                    <tr className="variance-row">
                      <td className="obs-name"><strong>Variância</strong></td>
                      <td>{fmt(varPC1, 4)}</td>
                      <td>{fmt(varPC2, 4)}</td>
                    </tr>
                    <tr className="pct-row">
                      <td className="obs-name"><strong>% da variância</strong></td>
                      <td>{fmtPct(pctPC1)}</td>
                      <td>{fmtPct(pctPC2)}</td>
                    </tr>
                  </tbody>
                </table>

                <p className="summary-stat" style={{ marginTop: 16 }}>
                  Soma das variâncias: <span>{fmt(sumVar, 4)}</span>
                </p>

                <div className="control-group" style={{ marginTop: 20 }}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={showPCPlot}
                      onChange={(e) => setShowPCPlot(e.target.checked)}
                    />
                    Mostrar gráfico das PCs
                  </label>
                </div>
              </div>

              {/* Chart: still the original view with line */}
              <div className="chart-container">
                <ScatterChart
                  data={displayData}
                  xLabel="Gene A"
                  yLabel="Gene B"
                  range={getRange(displayData)}
                  showLine={true}
                  showProjections={true}
                  lineAngle={effectiveAngle}
                />
              </div>
            </div>
          </section>
        )}

        {/* ================================================================
            STEP 4: Gráfico das componentes principais
            ================================================================ */}
        {centered && showLine && showPCPlot && (
          <section className="glass-card">
            <h2 className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
              </svg>
              Gráfico das componentes principais
            </h2>
            <p className="card-description">
              Os mesmos pontos agora representados no novo sistema de coordenadas (PC1 × PC2).
              {useBestAngle && (
                <span style={{ display: 'block', marginTop: 8, fontWeight: 600, color: '#2A9D8F' }}>
                  PC1 captura <strong>{fmtPct(pctPC1)}</strong> da variância total — máximo possível!
                </span>
              )}
            </p>

            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <div className="chart-container">
                <ScatterChart
                  data={pcData}
                  xLabel="PC1"
                  yLabel="PC2"
                  range={getRange(pcData)}
                  showLine={false}
                />
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <p>2026 Simulador PCA. Desenvolvido para a disciplina PCO207 (UNIFEI).</p>
          <a
            href="https://github.com/propercioggj/PCO207-PCA"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
          >
            <Icons.Github />
            <span>propercioggj/PCO207-PCA</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

export default App;
