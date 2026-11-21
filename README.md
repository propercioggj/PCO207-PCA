# Simulador PCA - Análise de Componentes Principais

Simulador interativo passo a passo de **PCA (Principal Component Analysis / Análise de Componentes Principais)** para fins didáticos. A aplicação explica visualmente cada etapa do processo de PCA, desde os dados originais até a visualização final no novo sistema de coordenadas (PC1 × PC2).

A interface visual utiliza a mesma identidade do sistema **Desenvolvimento** (tema calmante verde ardósia e fontes _Lexend_ e _Source Sans 3_), mantendo consistência com o simulador de BST.

---

## 📚 Conceito Didático

O simulador guia o aluno por **4 etapas interativas**:

### 1. Conhecendo os dados
- Exibe os dados brutos: 6 observações com 2 variáveis (Gene A e Gene B)
- Mostra tabela com variância e % da variância de cada variável
- Scatter plot dos dados originais
- Checkbox para **centralizar os dados** (subtrair a média)

### 2. Escolhendo uma reta
- Slider para rotacionar uma reta passando pela origem (0° a 180°)
- Visualização das **projeções ortogonais** dos pontos sobre a reta
- Métricas em tempo real:
  - Soma dos quadrados das distâncias até a reta
  - Soma dos quadrados das projeções até a origem
- Checkbox "Usar o melhor ângulo" que calcula automaticamente o ângulo do primeiro autovetor

### 3. Rotacionando os eixos
- Exibe as **coordenadas PC1 e PC2** de cada observação
- Mostra variância e % da variância nos novos eixos
- Demonstra que a soma das variâncias é preservada

### 4. Gráfico das componentes principais
- Scatter plot final no espaço PC1 × PC2
- Comparação visual com os dados originais

---

## 🚀 Tecnologias

| Tecnologia | Papel |
|---|---|
| **React 18** | Interface reativa e componentizada |
| **Canvas API** | Renderização dos gráficos scatter com eixos, projeções e reta |
| **Vite 5** | Bundler e dev server |
| **JavaScript (ES6+)** | Motor PCA: cálculo de média, variância, autovalores, autovetores, projeções |
| **CSS Design System** | Mesmo tema verde ardósia do projeto Tree |
| **Docker** | Conteinerização com Nginx Alpine |

---

## 📁 Estrutura

```
pca/
├── Dockerfile                      # Build multi-stage (Node + Nginx)
├── docker-compose.yml              # Orquestração (porta 8081 local)
├── docker-compose.override.yml     # Override: rede application_proxy para produção
├── README.md                       # Este arquivo
└── frontend/
    ├── index.html                  # HTML principal
    ├── nginx.conf                  # Config Nginx com cache de assets
    ├── package.json                # Dependências
    ├── vite.config.js              # Config do Vite
    └── src/
        ├── main.jsx                # Entry point React
        ├── App.jsx                 # Componente principal (PCA Engine + UI)
        └── App.css                 # Design System
```

---

## 🛠️ Como Executar

### Desenvolvimento Local

```bash
cd frontend
npm install
npm run dev
```

Acesse: 👉 **http://localhost:5174**

### Docker (Produção)

```bash
docker compose up -d --build
```

Acesse: 👉 **https://pca.propercio.dpdns.org**

> O arquivo `docker-compose.override.yml` conecta o container à rede `application_proxy` para funcionar com o proxy reverso em produção.

---

## GitHub

Repositório oficial:
👉 **[https://github.com/propercioggj/PCO207-PCA](https://github.com/propercioggj/PCO207-PCA)**

```bash
git clone git@github.com:propercioggj/PCO207-PCA.git
```

| Observação | Gene A | Gene B |
|---|---|---|
| 1 | 11,00 | 8,00 |
| 2 | 9,00 | 12,00 |
| 3 | 8,00 | 10,00 |
| 4 | 1,00 | 3,00 |
| 5 | 3,00 | 2,00 |
| 6 | 4,00 | 5,00 |

**Variância Gene A:** 15,2000 | **Variância Gene B:** 15,8667  
**Soma das variâncias:** 31,0667

Ao centralizar e encontrar o melhor ângulo (~45,73°):  
**PC1 captura 91,86%** | **PC2 captura 8,14%** da variância total.
