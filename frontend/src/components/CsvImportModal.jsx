import React, { useState, useRef } from 'react';
import { parseCsv, createDatasetFromImport } from '../data/datasetManager';

export default function CsvImportModal({ isOpen, onClose, onImportSuccess }) {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [selectedX, setSelectedX] = useState('');
  const [selectedY, setSelectedY] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [sampleSize, setSampleSize] = useState('6');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setDatasetName(file.name.replace(/\.[^/.]+$/, ''));
    setError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        processText(text, file.name);
      }
    };
    reader.onerror = () => {
      setError('Falha ao ler o arquivo selecionado.');
    };
    reader.readAsText(file);
  };

  const processText = (text, name = 'Dataset') => {
    try {
      setError('');
      setCsvText(text);
      const result = parseCsv(text);
      setParsed(result);

      // Pré-seleciona as duas primeiras colunas numéricas
      if (result.numericColumns.length >= 2) {
        setSelectedX(result.numericColumns[0].key);
        setSelectedY(result.numericColumns[1].key);
      }
      // Se houver coluna categórica/texto, sugere como rótulo
      if (result.stringColumns.length > 0) {
        setSelectedLabel(result.stringColumns[0].key);
      } else {
        setSelectedLabel('');
      }
      if (!datasetName) {
        setDatasetName(name);
      }
    } catch (err) {
      setError(err.message || 'Erro ao processar o CSV.');
      setParsed(null);
    }
  };

  const handlePasteProcess = () => {
    if (!csvText.trim()) {
      setError('Por favor, cole os dados CSV primeiro.');
      return;
    }
    processText(csvText, datasetName || 'Dataset Colado');
  };

  const handleConfirm = () => {
    if (!parsed) {
      setError('Processe um CSV válido primeiro.');
      return;
    }
    if (!selectedX || !selectedY) {
      setError('Selecione as variáveis dos Eixos X e Y.');
      return;
    }
    if (selectedX === selectedY) {
      setError('As variáveis dos Eixos X e Y devem ser diferentes.');
      return;
    }

    try {
      const newDataset = createDatasetFromImport({
        name: datasetName.trim() || 'Dataset Customizado',
        parsed,
        xCol: selectedX,
        yCol: selectedY,
        labelCol: selectedLabel || null,
        sampleSize
      });
      onImportSuccess(newDataset);
      onClose();
    } catch (err) {
      setError(err.message || 'Falha ao criar o dataset.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Importar Dataset CSV para o PCA
          </h2>
          <button className="btn-close-modal" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="modal-alert-error">{error}</div>}

          {/* Área de Seleção de Arquivo */}
          <div className="import-source-row">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Selecionar Arquivo .CSV
            </button>
            <span className="file-selected-name">
              {fileName ? `Arquivo: ${fileName}` : 'Ou cole o texto CSV abaixo:'}
            </span>
          </div>

          {/* Área de Colar CSV */}
          <div className="form-group" style={{ marginTop: 12 }}>
            <textarea
              className="csv-textarea"
              rows={4}
              placeholder="Exemplo:&#10;var1,var2,categoria&#10;10.5,20.1,Grupo A&#10;12.3,18.4,Grupo B"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <button
              className="btn btn-secondary"
              style={{ alignSelf: 'flex-start', marginTop: 6 }}
              onClick={handlePasteProcess}
            >
              Processar Texto CSV
            </button>
          </div>

          {/* Configuração das Colunas e Amostragem (visível após parsing) */}
          {parsed && (
            <div className="parsed-settings-box">
              <div className="parsed-badge-info">
                ✓ Detectadas <strong>{parsed.totalRows}</strong> linhas e <strong>{parsed.numericColumns.length}</strong> colunas numéricas (Delimitador: <code>{parsed.delimiter === ';' ? 'Ponto e Vírgula (;)' : 'Vírgula (,)'}</code>)
              </div>

              <div className="grid-2-cols" style={{ marginTop: 12 }}>
                <div className="form-field">
                  <label className="field-label">Nome do Dataset:</label>
                  <input
                    type="text"
                    className="input-field"
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">Amostra Didática:</label>
                  <select
                    className="select-field"
                    value={sampleSize}
                    onChange={(e) => setSampleSize(e.target.value)}
                  >
                    <option value="6">6 Observações (Didático / Passo a Passo)</option>
                    <option value="12">12 Observações</option>
                    <option value="30">30 Observações</option>
                    <option value="all">Todas as {parsed.totalRows} Observações</option>
                  </select>
                </div>
              </div>

              <div className="grid-3-cols" style={{ marginTop: 12 }}>
                <div className="form-field">
                  <label className="field-label">Variável 1 (Eixo X):</label>
                  <select
                    className="select-field"
                    value={selectedX}
                    onChange={(e) => setSelectedX(e.target.value)}
                  >
                    {parsed.numericColumns.map(c => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="field-label">Variável 2 (Eixo Y):</label>
                  <select
                    className="select-field"
                    value={selectedY}
                    onChange={(e) => setSelectedY(e.target.value)}
                  >
                    {parsed.numericColumns.map(c => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="field-label">Coluna de Rótulo (Opcional):</label>
                  <select
                    className="select-field"
                    value={selectedLabel}
                    onChange={(e) => setSelectedLabel(e.target.value)}
                  >
                    <option value="">Nenhum (Gerar Observação 1, 2...)</option>
                    {parsed.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-success"
            onClick={handleConfirm}
            disabled={!parsed}
          >
            Carregar no Simulador
          </button>
        </div>
      </div>
    </div>
  );
}
