import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './App.css';
import {
  PENGUINS_DATASET,
  PESO_ALTURA_DATASET,
  GENES_DATASET,
  SPECIES_COLORS,
  DEFAULT_POINT_COLOR
} from './data/datasetManager';
import DatasetControls from './components/DatasetControls';
import CsvImportModal from './components/CsvImportModal';

// ============================================================================
// PCA Math Engine (Genérico para 2D)
// ============================================================================
const PCAEngine = {
  mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  },

  variance(arr) {
    if (arr.length <= 1) return 0;
    const m = this.mean(arr);
    return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  },

  covariance(arrX, arrY) {
    if (arrX.length <= 1) return 0;
    const mx = this.mean(arrX);
    const my = this.mean(arrY);
    return arrX.reduce((s, x, i) => s + (x - mx) * (arrY[i] - my), 0) / (arrX.length - 1);
  },

  standardDeviation(arr) {
    return Math.sqrt(this.variance(arr));
  },

  centerPoints(points) {
    const col0 = points.map(p => p.x);
    const col1 = points.map(p => p.y);
    const m0 = this.mean(col0);
    const m1 = this.mean(col1);
    return points.map(p => ({
      ...p,
      x: p.x - m0,
      y: p.y - m1,
      origX: p.x,
      origY: p.y
    }));
  },

  standardizePoints(points) {
    const col0 = points.map(p => p.x);
    const col1 = points.map(p => p.y);
    const m0 = this.mean(col0);
    const m1 = this.mean(col1);
    const s0 = Math.sqrt(this.variance(col0)) || 1;
    const s1 = Math.sqrt(this.variance(col1)) || 1;
    return points.map(p => ({
      ...p,
      x: (p.x - m0) / s0,
      y: (p.y - m1) / s1,
      origX: p.x,
      origY: p.y
    }));
  },

  projectOntoLine(point, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    const dot = point.x * dx + point.y * dy;
    return { x: dot * dx, y: dot * dy, scalar: dot };
  },

  distToLineSquared(point, angleDeg) {
    const proj = this.projectOntoLine(point, angleDeg);
    return (point.x - proj.x) ** 2 + (point.y - proj.y) ** 2;
  },

  sumDistSquared(points, angleDeg) {
    return points.reduce((s, p) => s + this.distToLineSquared(p, angleDeg), 0);
  },

  sumProjSquared(points, angleDeg) {
    return points.reduce((s, p) => {
      const proj = this.projectOntoLine(p, angleDeg);
      return s + proj.scalar ** 2;
    }, 0);
  },

  findBestAngle(points) {
    const col0 = points.map(p => p.x);
    const col1 = points.map(p => p.y);
    const v0 = this.variance(col0);
    const v1 = this.variance(col1);
    const cov = this.covariance(col0, col1);

    const trace = v0 + v1;
    const det = v0 * v1 - cov * cov;
    const disc = Math.sqrt(Math.max(0, trace * trace - 4 * det));
    const lambda1 = (trace + disc) / 2;

    let vx, vy;
    if (Math.abs(cov) > 1e-10) {
      vx = lambda1 - v1;
      vy = cov;
    } else if (v0 >= v1) {
      vx = 1; vy = 0;
    } else {
      vx = 0; vy = 1;
    }

    let angle = (Math.atan2(vy, vx) * 180) / Math.PI;
    return ((angle % 180) + 180) % 180;
  },

  rotateToPC(points, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return points.map(p => {
      const pc1 = p.x * cos + p.y * sin;
      const pc2 = -p.x * sin + p.y * cos;
      return {
        ...p,
        pc1,
        pc2
      };
    });
  }
};

// ============================================================================
// Ícones SVG Inline
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
// Canvas Scatter Chart com Eixos, Projeções e Cores por Categoria
// ============================================================================
const ScatterChart = ({
  points,
  xProp,
  yProp,
  xLabel,
  yLabel,
  lineAngle,
  showLine,
  showProjections,
  range,
  categoryKey
}) => {
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !points.length) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = rect.width;
    const H = rect.height;
    const pad = { top: 30, right: 30, bottom: 50, left: 65 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    const r = range || 10;
    const toX = v => pad.left + ((v + r) / (2 * r)) * plotW;
    const toY = v => pad.top + ((r - v) / (2 * r)) * plotH;

    // Fundo limpo
    ctx.fillStyle = '#FFFFFE';
    ctx.fillRect(0, 0, W, H);

    // Grid suave
    ctx.strokeStyle = '#E8EFEE';
    ctx.lineWidth = 0.5;
    const step = r <= 5 ? 1 : r <= 15 ? 2 : r <= 50 ? 10 : r <= 150 ? 25 : 50;
    for (let v = -r; v <= r; v += step) {
      ctx.beginPath(); ctx.moveTo(toX(v), pad.top); ctx.lineTo(toX(v), pad.top + plotH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.left, toY(v)); ctx.lineTo(pad.left + plotW, toY(v)); ctx.stroke();
    }

    // Eixos Principais
    ctx.strokeStyle = '#203335';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pad.left, toY(0)); ctx.lineTo(pad.left + plotW, toY(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(0), pad.top); ctx.lineTo(toX(0), pad.top + plotH); ctx.stroke();

    // Rótulos de escala dos eixos
    ctx.fillStyle = '#5F7577';
    ctx.font = '11px Source Sans 3, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let v = -r; v <= r; v += step) {
      if (Math.abs(v) < 1e-6) continue;
      // Eixo X
      ctx.beginPath(); ctx.moveTo(toX(v), toY(0) - 3); ctx.lineTo(toX(v), toY(0) + 3); ctx.stroke();
      ctx.fillText(Number(v.toFixed(1)).toString(), toX(v), toY(0) + 6);
      // Eixo Y
      ctx.beginPath(); ctx.moveTo(toX(0) - 3, toY(v)); ctx.lineTo(toX(0) + 3, toY(v)); ctx.stroke();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(Number(v.toFixed(1)).toString(), toX(0) - 6, toY(v));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
    }

    // Títulos dos Eixos
    ctx.fillStyle = '#203335';
    ctx.font = 'bold 13px Lexend, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(xLabel, pad.left + plotW / 2, H - 18);

    ctx.save();
    ctx.translate(18, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'middle';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Reta passando pela origem
    if (showLine && lineAngle !== undefined) {
      const rad = (lineAngle * Math.PI) / 180;
      const len = r * 1.6;
      const x1 = -len * Math.cos(rad), y1 = -len * Math.sin(rad);
      const x2 = len * Math.cos(rad), y2 = len * Math.sin(rad);

      ctx.strokeStyle = '#2A9D8F';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(toX(x1), toY(y1));
      ctx.lineTo(toX(x2), toY(y2));
      ctx.stroke();

      // Projeções Ortogonais (Linhas tracejadas)
      if (showProjections) {
        ctx.strokeStyle = '#203335';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        const projSubset = points.length > 30 ? points.filter((_, i) => i % Math.ceil(points.length / 25) === 0) : points;

        projSubset.forEach(p => {
          const px = p[xProp];
          const py = p[yProp];
          const proj = PCAEngine.projectOntoLine({ x: px, y: py }, lineAngle);

          ctx.beginPath();
          ctx.moveTo(toX(px), toY(py));
          ctx.lineTo(toX(proj.x), toY(proj.y));
          ctx.stroke();

          // Ponto de projeção sobre a reta
          ctx.fillStyle = '#203335';
          ctx.beginPath();
          ctx.arc(toX(proj.x), toY(proj.y), points.length > 30 ? 2.5 : 4, 0, 2 * Math.PI);
          ctx.fill();
        });
        ctx.setLineDash([]);
      }
    }

    // Renderização dos Pontos de Dados
    const isLarge = points.length > 30;
    points.forEach((p, idx) => {
      const px = p[xProp];
      const py = p[yProp];
      const category = categoryKey ? p[categoryKey] : null;
      const pointColor = (category && SPECIES_COLORS[category]) ? SPECIES_COLORS[category] : DEFAULT_POINT_COLOR;

      ctx.fillStyle = pointColor;
      ctx.beginPath();
      ctx.arc(toX(px), toY(py), isLarge ? 3.5 : 5.5, 0, 2 * Math.PI);
      ctx.fill();

      // Contorno fino para destacar
      ctx.strokeStyle = '#FFFFFE';
      ctx.lineWidth = isLarge ? 0.8 : 1.5;
      ctx.stroke();

      // Rótulos de números para datasets pequenos didáticos
      if (points.length <= 12) {
        ctx.fillStyle = '#203335';
        ctx.font = 'bold 10px Lexend, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(idx + 1), toX(px) + 6, toY(py) - 4);
      }
    });
  }, [points, xProp, yProp, xLabel, yLabel, lineAngle, showLine, showProjections, range, categoryKey]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
};

// ============================================================================
// Componente Principal do Simulador PCA
// ============================================================================
function App() {
  // === Lista de Datasets Disponíveis ===
  const [datasets, setDatasets] = useState([PENGUINS_DATASET, PESO_ALTURA_DATASET, GENES_DATASET]);
  const [activeDatasetId, setActiveDatasetId] = useState('penguins');
  const [activeSampleKey, setActiveSampleKey] = useState('didactic6');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Dataset ativo
  const currentDataset = useMemo(() => {
    return datasets.find(d => d.id === activeDatasetId) || datasets[0];
  }, [datasets, activeDatasetId]);

  // Colunas selecionadas
  const [xCol, setXCol] = useState(currentDataset.defaultX);
  const [yCol, setYCol] = useState(currentDataset.defaultY);

  // Sincroniza colunas ao trocar dataset
  useEffect(() => {
    setXCol(currentDataset.defaultX);
    setYCol(currentDataset.defaultY);
    const sampleKeys = Object.keys(currentDataset.samples || {});
    if (!currentDataset.samples[activeSampleKey]) {
      setActiveSampleKey(sampleKeys[0] || 'default');
    }
    setCentered(false);
    setStandardized(false);
    setShowLine(false);
    setUseBestAngle(false);
    setShowPCPlot(false);
  }, [currentDataset]);

  // Extrai as observações ativas
  const rawObservations = useMemo(() => {
    const sample = currentDataset.samples[activeSampleKey] || currentDataset.samples[Object.keys(currentDataset.samples)[0]];
    return sample ? sample.rows : [];
  }, [currentDataset, activeSampleKey]);

  // Formata pontos com x e y
  const rawPoints = useMemo(() => {
    return rawObservations.map((r, i) => ({
      ...r,
      id: r.id || i + 1,
      x: Number(r[xCol]),
      y: Number(r[yCol])
    }));
  }, [rawObservations, xCol, yCol]);

  // === Estados dos Passos Interativos ===
  const [centered, setCentered] = useState(false);
  const [standardized, setStandardized] = useState(false);
  const [showLine, setShowLine] = useState(false);
  const [angle, setAngle] = useState(30);
  const [useBestAngle, setUseBestAngle] = useState(false);
  const [showPCPlot, setShowPCPlot] = useState(false);

  // Pontos ativos (originais, centrados ou padronizados na origem)
  const displayPoints = useMemo(() => {
    if (standardized) return PCAEngine.standardizePoints(rawPoints);
    if (centered) return PCAEngine.centerPoints(rawPoints);
    return rawPoints;
  }, [rawPoints, centered, standardized]);

  // Estatísticas das variáveis originais/centradas/padronizadas
  const colX = displayPoints.map(p => p.x);
  const colY = displayPoints.map(p => p.y);
  const varX = PCAEngine.variance(colX);
  const varY = PCAEngine.variance(colY);
  const sumVar = varX + varY;
  const pctX = sumVar > 0 ? (varX / sumVar) * 100 : 50;
  const pctY = sumVar > 0 ? (varY / sumVar) * 100 : 50;

  // Melhor ângulo analítico do autovetor da matriz de covariância
  const bestAngle = useMemo(() => {
    if ((!centered && !standardized) || !displayPoints.length) return 0;
    return PCAEngine.findBestAngle(displayPoints);
  }, [displayPoints, centered, standardized]);

  const effectiveAngle = useBestAngle ? bestAngle : angle;

  // Dados projetados e rotacionados no sistema PC1 × PC2
  const pcPoints = useMemo(() => {
    if (!displayPoints.length) return [];
    return PCAEngine.rotateToPC(displayPoints, effectiveAngle);
  }, [displayPoints, effectiveAngle]);

  const pc1Col = pcPoints.map(p => p.pc1);
  const pc2Col = pcPoints.map(p => p.pc2);
  const varPC1 = PCAEngine.variance(pc1Col);
  const varPC2 = PCAEngine.variance(pc2Col);
  const sumVarPC = varPC1 + varPC2;
  const pctPC1 = sumVarPC > 0 ? (varPC1 / sumVarPC) * 100 : 0;
  const pctPC2 = sumVarPC > 0 ? (varPC2 / sumVarPC) * 100 : 0;

  const isTransformed = centered || standardized;
  const sumDistSq = isTransformed ? PCAEngine.sumDistSquared(displayPoints, effectiveAngle) : 0;
  const sumProjSq = isTransformed ? PCAEngine.sumProjSquared(displayPoints, effectiveAngle) : 0;

  // Range adaptativo para o Canvas
  const chartRange = useMemo(() => {
    if (!displayPoints.length) return 10;
    if (standardized) return 2;
    const all = displayPoints.flatMap(p => [Math.abs(p.x), Math.abs(p.y)]);
    const m = Math.ceil(Math.max(...all) * 1.25);
    return Math.max(m, 2);
  }, [displayPoints, standardized]);

  const pcChartRange = useMemo(() => {
    if (!pcPoints.length) return 10;
    if (standardized) return 2;
    const all = pcPoints.flatMap(p => [Math.abs(p.pc1), Math.abs(p.pc2)]);
    const m = Math.ceil(Math.max(...all) * 1.25);
    return Math.max(m, 2);
  }, [pcPoints, standardized]);

  // Formatação de números padrão brasileiro
  const fmt = (n, dec = 2) => {
    if (typeof n !== 'number' || isNaN(n)) return '—';
    return n.toFixed(dec).replace('.', ',');
  };
  const fmtPct = (n) => fmt(n, 2) + '%';

  const fmtCoord = (n, colKey) => {
    if (typeof n !== 'number' || isNaN(n)) return '—';
    if (!standardized) {
      if (colKey === 'altura' || (Math.abs(n) < 1 && Math.abs(n) > 0.0001)) {
        return n.toFixed(3).replace('.', ',');
      }
      return n.toFixed(2).replace('.', ',');
    }
    const str = n.toFixed(4);
    return parseFloat(str).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  // Atualiza slider quando "Usar o melhor ângulo" é marcado
  useEffect(() => {
    if (useBestAngle && (centered || standardized)) {
      setAngle(Math.round(bestAngle));
    }
  }, [useBestAngle, centered, standardized, bestAngle]);

  // Manipulador de Importação de Novo Dataset
  const handleImportSuccess = (newDataset) => {
    setDatasets(prev => [newDataset, ...prev]);
    setActiveDatasetId(newDataset.id);
    setActiveSampleKey(Object.keys(newDataset.samples)[0]);
  };

  // Nomes das colunas para os eixos
  const xColLabel = currentDataset.numericColumns.find(c => c.key === xCol)?.label || xCol;
  const yColLabel = currentDataset.numericColumns.find(c => c.key === yCol)?.label || yCol;

  return (
    <div className="app-container">
      {/* Cabeçalho */}
      <header className="app-header">
        <div className="header-title">
          <h1>
            <Icons.Chart />
            {currentDataset.id === 'peso_altura'
              ? 'Entendendo a importância da padronização na PCA'
              : 'Entendendo a PCA passo a passo'}
          </h1>
          <p>Simulador didático e visual de Análise de Componentes Principais</p>
        </div>
        <span className="badge-mestrado">PCO207 - UNIFEI</span>
      </header>

      {/* Barra de Seleção e Importação de Datasets */}
      <DatasetControls
        datasets={datasets}
        activeDatasetId={activeDatasetId}
        onSelectDataset={setActiveDatasetId}
        activeSampleKey={activeSampleKey}
        onSelectSample={setActiveSampleKey}
        xCol={xCol}
        onChangeXCol={setXCol}
        yCol={yCol}
        onChangeYCol={setYCol}
        onOpenImportModal={() => setIsImportModalOpen(true)}
      />

      <main className="app-content">

        {/* ================================================================
            PASSO 1: Conhecendo os dados
            ================================================================ */}
        <section className="glass-card">
          <h2 className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            Conhecendo os dados
          </h2>
          <p className="card-description">
            {currentDataset.id === 'peso_altura' ? (
              <>Agora temos duas variáveis medidas nas mesmas 10 pessoas: <strong>peso, em kg</strong>, e <strong>altura, em metros</strong>.</>
            ) : currentDataset.id === 'genes' ? (
              <>Começamos com duas variáveis medidas nas mesmas <strong>seis observações</strong>.</>
            ) : (
              <>Começamos com duas variáveis medidas em <strong>{displayPoints.length} observações</strong> no dataset <strong>{currentDataset.name}</strong>.</>
            )}
          </p>

          <div className="checkboxes-container">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={centered}
                onChange={(e) => {
                  const val = e.target.checked;
                  setCentered(val);
                  if (!val) {
                    setStandardized(false);
                    setShowLine(false);
                    setUseBestAngle(false);
                    setShowPCPlot(false);
                  }
                }}
              />
              <strong>Centralizar os dados</strong>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={standardized}
                onChange={(e) => {
                  const val = e.target.checked;
                  setStandardized(val);
                  if (val) {
                    setCentered(true);
                  }
                }}
              />
              <strong>Padronizar os dados</strong>
            </label>

            <p className="standardize-hint">
              A padronização centraliza os dados e, além disso, divide cada variável pelo seu desvio-padrão.
            </p>
          </div>

          <div className="section-layout">
            {/* Tabela de Dados */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: '1.05rem', color: '#203335', fontWeight: 600 }}>Base de dados</h3>
                {displayPoints.length > 15 && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Exibindo as primeiras 15 de {displayPoints.length} observações
                  </span>
                )}
              </div>

              <div className="table-scroll-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Observação</th>
                      <th>{xColLabel}</th>
                      <th>{yColLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayPoints.slice(0, 15).map((row, i) => (
                      <tr key={i}>
                        <td className="obs-name">
                          {row.name || `Observação ${i + 1}`}
                          {row[currentDataset.categoryKey] && (
                            <span
                              style={{
                                marginLeft: 6,
                                display: 'inline-block',
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: SPECIES_COLORS[row[currentDataset.categoryKey]] || DEFAULT_POINT_COLOR
                              }}
                            />
                          )}
                        </td>
                        <td>{fmtCoord(row.x, xCol)}</td>
                        <td>{fmtCoord(row.y, yCol)}</td>
                      </tr>
                    ))}
                    <tr className="variance-row">
                      <td className="obs-name"><strong>Variância</strong></td>
                      <td>{fmt(varX, standardized ? 4 : (varX < 0.1 ? 6 : 4))}</td>
                      <td>{fmt(varY, standardized ? 4 : (varY < 0.1 ? 6 : 4))}</td>
                    </tr>
                    <tr className="pct-row">
                      <td className="obs-name"><strong>% da variância</strong></td>
                      <td>{fmtPct(pctX)}</td>
                      <td>{fmtPct(pctY)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="summary-stat">
                Soma das variâncias {standardized ? 'padronizadas' : 'originais'}: <span>{fmt(sumVar, standardized ? 4 : (sumVar < 1 ? 6 : 4))}</span>
              </p>
            </div>

            {/* Gráfico de Dispersão */}
            <div className="chart-container">
              <ScatterChart
                points={displayPoints}
                xProp="x"
                yProp="y"
                xLabel={xColLabel}
                yLabel={yColLabel}
                range={chartRange}
                showLine={false}
                categoryKey={currentDataset.categoryKey}
              />
            </div>
          </div>
        </section>

        {/* ================================================================
            PASSO 2: Escolhendo uma reta (visível com dados centrados ou padronizados)
            ================================================================ */}
        {isTransformed && (
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
              Podemos escolher uma reta qualquer passando pela origem e observar como os pontos se comportam quando projetados sobre ela.
            </p>

            <div className="section-layout">
              {/* Controles de Rotação */}
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
                    <strong>Inserir reta</strong>
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
                        <strong>Usar o melhor ângulo</strong> (calculado via autovetor da covariância)
                      </label>

                      {useBestAngle && (
                        <div className="metric-highlight">
                          Melhor ângulo analítico: <span>{fmt(bestAngle)}°</span>
                        </div>
                      )}

                      <div className="metric-display">
                        <strong>Soma dos quadrados das distâncias até a reta:</strong>{' '}
                        <span>{fmt(sumDistSq, 4)}</span>
                      </div>
                      <div className="metric-display">
                        <strong>Soma dos quadrados das projeções até a origem:</strong>{' '}
                        <span>{fmt(sumProjSq, 4)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Gráfico com a Reta e Projeções */}
              <div className="chart-container">
                <ScatterChart
                  points={displayPoints}
                  xProp="x"
                  yProp="y"
                  xLabel={xColLabel}
                  yLabel={yColLabel}
                  range={chartRange}
                  showLine={showLine}
                  showProjections={showLine}
                  lineAngle={effectiveAngle}
                  categoryKey={currentDataset.categoryKey}
                />
              </div>
            </div>
          </section>
        )}

        {/* ================================================================
            PASSO 3: Rotacionando os eixos
            ================================================================ */}
        {isTransformed && showLine && (
          <section className="glass-card">
            <h2 className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Rotacionando os eixos
            </h2>
            <p className="card-description">
              A reta escolhida define um novo eixo. As coordenadas dos pontos nesse novo sistema de coordenadas são chamadas de <strong>PC1</strong> e <strong>PC2</strong>.
            </p>

            <div className="section-layout">
              {/* Tabela de Coordenadas PC */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: '1.05rem', color: '#203335', fontWeight: 600 }}>Coordenadas PC</h3>
                  {pcPoints.length > 15 && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Exibindo as primeiras 15 de {pcPoints.length} observações
                    </span>
                  )}
                </div>

                <div className="table-scroll-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Observação</th>
                        <th>PC1</th>
                        <th>PC2</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pcPoints.slice(0, 15).map((row, i) => (
                        <tr key={i}>
                          <td className="obs-name">
                            {row.name || `Observação ${i + 1}`}
                            {row[currentDataset.categoryKey] && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  display: 'inline-block',
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor: SPECIES_COLORS[row[currentDataset.categoryKey]] || DEFAULT_POINT_COLOR
                                }}
                              />
                            )}
                          </td>
                          <td>{fmt(row.pc1, 4)}</td>
                          <td>{fmt(row.pc2, 4)}</td>
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
                </div>

                <p className="summary-stat">
                  Soma das variâncias das PCs: <span>{fmt(sumVarPC, 4)}</span>
                </p>

                <div className="control-group" style={{ marginTop: 20 }}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={showPCPlot}
                      onChange={(e) => setShowPCPlot(e.target.checked)}
                    />
                    <strong>Mostrar gráfico das PCs</strong>
                  </label>
                </div>
              </div>

              {/* Gráfico de Referência */}
              <div className="chart-container">
                <ScatterChart
                  points={displayPoints}
                  xProp="x"
                  yProp="y"
                  xLabel={xColLabel}
                  yLabel={yColLabel}
                  range={chartRange}
                  showLine={true}
                  showProjections={true}
                  lineAngle={effectiveAngle}
                  categoryKey={currentDataset.categoryKey}
                />
              </div>
            </div>
          </section>
        )}

        {/* ================================================================
            PASSO 4: Gráfico das componentes principais
            ================================================================ */}
        {isTransformed && showLine && showPCPlot && (
          <section className="glass-card">
            <h2 className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
              </svg>
              Gráfico das componentes principais
            </h2>
            <p className="card-description">
              Os mesmos pontos agora estão expressos no novo sistema ortogonal (PC1 × PC2).
              {useBestAngle && (
                <span style={{ display: 'block', marginTop: 8, fontWeight: 600, color: '#2A9D8F' }}>
                  O eixo PC1 captura <strong>{fmtPct(pctPC1)}</strong> de toda a variabilidade presente no conjunto de dados!
                </span>
              )}
            </p>

            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              <div className="chart-container">
                <ScatterChart
                  points={pcPoints}
                  xProp="pc1"
                  yProp="pc2"
                  xLabel="PC1"
                  yLabel="PC2"
                  range={pcChartRange}
                  showLine={false}
                  categoryKey={currentDataset.categoryKey}
                />
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Modal de Importação CSV */}
      <CsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

      {/* Rodapé */}
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
