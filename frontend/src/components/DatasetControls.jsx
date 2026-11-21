import React from 'react';
import { SPECIES_COLORS } from '../data/datasetManager';

export default function DatasetControls({
  datasets,
  activeDatasetId,
  onSelectDataset,
  activeSampleKey,
  onSelectSample,
  xCol,
  onChangeXCol,
  yCol,
  onChangeYCol,
  standardize,
  onToggleStandardize,
  onOpenImportModal
}) {
  const currentDataset = datasets.find(d => d.id === activeDatasetId) || datasets[0];
  const sampleKeys = Object.keys(currentDataset.samples || {});

  return (
    <div className="glass-card dataset-controls-card">
      <div className="dataset-controls-top">
        <div className="dataset-controls-heading">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          <div>
            <h3 className="dataset-controls-title">Configuração do Dataset para PCA</h3>
            <p className="dataset-controls-subtitle">{currentDataset.description}</p>
          </div>
        </div>

        <button className="btn btn-secondary btn-import-csv" onClick={onOpenImportModal}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Importar Novo Dataset (CSV)...
        </button>
      </div>

      <div className="dataset-controls-grid">
        {/* Seletor de Dataset */}
        <div className="control-item">
          <label className="field-label">Dataset Ativo:</label>
          <select
            className="select-field"
            value={activeDatasetId}
            onChange={(e) => onSelectDataset(e.target.value)}
          >
            {datasets.map(d => (
              <option key={d.id} value={d.id}>
                {d.id === 'penguins' ? '🐧 ' : d.id === 'genes' ? '🧬 ' : '📁 '}
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Seletor de Amostra Didática */}
        {sampleKeys.length > 1 && (
          <div className="control-item">
            <label className="field-label">Tamanho da Amostra:</label>
            <select
              className="select-field"
              value={activeSampleKey}
              onChange={(e) => onSelectSample(e.target.value)}
            >
              {sampleKeys.map(k => (
                <option key={k} value={k}>
                  {currentDataset.samples[k].label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Variável Eixo X */}
        <div className="control-item">
          <label className="field-label">Variável 1 (Eixo X):</label>
          <select
            className="select-field"
            value={xCol}
            onChange={(e) => onChangeXCol(e.target.value)}
          >
            {currentDataset.numericColumns.map(col => (
              <option key={col.key} value={col.key}>{col.label}</option>
            ))}
          </select>
        </div>

        {/* Variável Eixo Y */}
        <div className="control-item">
          <label className="field-label">Variável 2 (Eixo Y):</label>
          <select
            className="select-field"
            value={yCol}
            onChange={(e) => onChangeYCol(e.target.value)}
          >
            {currentDataset.numericColumns.map(col => (
              <option key={col.key} value={col.key}>{col.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Legenda de Categorias / Espécies (se houver) */}
      {currentDataset.categoryKey === 'species' && (
        <div className="dataset-species-legend">
          <span className="legend-label">Espécies de Pinguins:</span>
          {Object.entries(SPECIES_COLORS).map(([species, color]) => (
            <span key={species} className="species-badge" style={{ borderColor: color, color }}>
              <span className="species-dot" style={{ backgroundColor: color }} />
              {species}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

