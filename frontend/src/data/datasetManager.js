import penguinsRaw from './penguinsData.json';

// Espécies e cores no Design System
export const SPECIES_COLORS = {
  Adelie: '#E76F51',      // Terracota
  Chinstrap: '#7209B7',   // Púrpura ardósia
  Gentoo: '#2A9D8F',      // Teal / Verde Ardósia
};

export const DEFAULT_POINT_COLOR = '#B22222';

// Dataset Clássico Genômico
export const GENES_DATASET = {
  id: 'genes',
  name: 'Genômica Didática (Gene A vs Gene B)',
  description: 'Exemplo clássico com 6 observações e 2 variáveis de expressão gênica.',
  categoryKey: null,
  numericColumns: [
    { key: 'geneA', label: 'Gene A' },
    { key: 'geneB', label: 'Gene B' }
  ],
  defaultX: 'geneA',
  defaultY: 'geneB',
  samples: {
    '6': {
      label: '6 Observações (Padrão)',
      rows: [
        { id: 1, name: 'Observação 1', geneA: 11, geneB: 8 },
        { id: 2, name: 'Observação 2', geneA: 9, geneB: 12 },
        { id: 3, name: 'Observação 3', geneA: 8, geneB: 10 },
        { id: 4, name: 'Observação 4', geneA: 1, geneB: 3 },
        { id: 5, name: 'Observação 5', geneA: 3, geneB: 2 },
        { id: 6, name: 'Observação 6', geneA: 4, geneB: 5 },
      ]
    }
  }
};

// Amostra balanceada de 15 pinguins (5 de cada espécie)
const sample15Penguins = [
  ...penguinsRaw.all.filter(p => p.species === 'Adelie').slice(0, 5),
  ...penguinsRaw.all.filter(p => p.species === 'Chinstrap').slice(0, 5),
  ...penguinsRaw.all.filter(p => p.species === 'Gentoo').slice(0, 5),
];

// Dataset Palmer Penguins
export const PENGUINS_DATASET = {
  id: 'penguins',
  name: 'Palmer Penguins (Seaborn)',
  description: 'Medições morfológicas de 3 espécies de pinguins do Arquipélago Palmer (Antártica).',
  categoryKey: 'species',
  categories: ['Adelie', 'Chinstrap', 'Gentoo'],
  numericColumns: [
    { key: 'bill_length_mm', label: 'Comprimento do Bico (mm)' },
    { key: 'flipper_length_mm', label: 'Comprimento da Nadadeira (mm)' },
    { key: 'bill_depth_mm', label: 'Profundidade do Bico (mm)' },
    { key: 'body_mass_g', label: 'Massa Corporal (g)' }
  ],
  defaultX: 'bill_length_mm',
  defaultY: 'flipper_length_mm',
  samples: {
    'didactic6': {
      label: 'Amostra Didática (6 Pinguins - Recomendado)',
      description: '2 de cada espécie para visualização nítida linha a linha',
      rows: penguinsRaw.didactic6.map((p, i) => ({
        ...p,
        name: `Pinguim ${i + 1} (${p.species})`
      }))
    },
    'sample15': {
      label: 'Amostra Balanceada (15 Pinguins)',
      description: '5 de cada espécie para observar tendências',
      rows: sample15Penguins.map((p, i) => ({
        ...p,
        name: `Pinguim ${i + 1} (${p.species})`
      }))
    },
    'all': {
      label: 'População Completa (342 Pinguins)',
      description: 'Nuvem completa com visualização de agrupamento',
      rows: penguinsRaw.all.map((p, i) => ({
        ...p,
        name: `Pinguim ${p.id} (${p.species})`
      }))
    }
  }
};

// Parser robusto de CSV
export function parseCsv(text) {
  if (!text || !text.trim()) {
    throw new Error('O arquivo CSV está vazio.');
  }

  const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('O CSV precisa conter ao menos o cabeçalho e uma linha de dados.');
  }

  // Detecta delimitador (, ou ;)
  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  const parseRow = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(headerLine).map(h => h.replace(/^["']|["']$/g, '').trim());

  const parsedRows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]).map(v => v.replace(/^["']|["']$/g, '').trim());
    if (values.length !== headers.length) continue;
    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx];
    });
    parsedRows.push(rowObj);
  }

  if (parsedRows.length === 0) {
    throw new Error('Nenhuma linha de dados válida encontrada no arquivo CSV.');
  }

  // Descobre colunas numéricas (onde mais de 80% dos valores convertem para float)
  const numericColumns = [];
  const stringColumns = [];

  headers.forEach(h => {
    let numericCount = 0;
    parsedRows.forEach(row => {
      const val = row[h];
      if (val !== undefined && val !== null && val !== '') {
        // Trata vírgula como separador decimal brasileiro
        const num = parseFloat(String(val).replace(',', '.'));
        if (!isNaN(num)) numericCount++;
      }
    });

    if (numericCount / parsedRows.length >= 0.7) {
      numericColumns.push({ key: h, label: h });
    } else {
      stringColumns.push({ key: h, label: h });
    }
  });

  if (numericColumns.length < 2) {
    throw new Error(`O arquivo precisa ter ao menos duas colunas numéricas para o PCA 2D. Encontradas: ${numericColumns.length}`);
  }

  return {
    headers,
    numericColumns,
    stringColumns,
    rows: parsedRows,
    totalRows: parsedRows.length,
    delimiter
  };
}

// Cria um objeto de dataset a partir de dados importados
export function createDatasetFromImport({ name, parsed, xCol, yCol, labelCol, sampleSize }) {
  // Limpa e extrai valores numéricos válidos para X e Y
  const validRows = [];
  parsed.rows.forEach((r, idx) => {
    const rawX = r[xCol];
    const rawY = r[yCol];
    const valX = parseFloat(String(rawX).replace(',', '.'));
    const valY = parseFloat(String(rawY).replace(',', '.'));
    if (!isNaN(valX) && !isNaN(valY)) {
      const labelVal = labelCol && r[labelCol] ? String(r[labelCol]) : `Obs ${idx + 1}`;
      validRows.push({
        id: idx + 1,
        name: labelVal,
        [xCol]: valX,
        [yCol]: valY,
        ...(labelCol ? { [labelCol]: labelVal } : {})
      });
    }
  });

  if (validRows.length < 3) {
    throw new Error('O dataset precisa ter ao menos 3 observações com valores numéricos válidos.');
  }

  // Cria amostra selecionada
  let selectedRows = validRows;
  if (sampleSize && sampleSize !== 'all' && Number(sampleSize) < validRows.length) {
    const count = Number(sampleSize);
    // Seleção equiespaçada representativa
    const step = Math.max(1, Math.floor(validRows.length / count));
    selectedRows = [];
    for (let i = 0; i < validRows.length && selectedRows.length < count; i += step) {
      selectedRows.push(validRows[i]);
    }
  }

  return {
    id: `custom_${Date.now()}`,
    name: name || 'Dataset Importado',
    description: `Importado com ${validRows.length} observações válidas.`,
    categoryKey: labelCol || null,
    numericColumns: [
      { key: xCol, label: xCol },
      { key: yCol, label: yCol }
    ],
    defaultX: xCol,
    defaultY: yCol,
    samples: {
      default: {
        label: `${selectedRows.length} Observações (${sampleSize === 'all' ? 'Completo' : 'Amostra Didática'})`,
        rows: selectedRows
      }
    }
  };
}

