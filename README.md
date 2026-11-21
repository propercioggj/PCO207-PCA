<div align="center">

# PCO207<br>Tópicos Especiais em Inteligência Artificial<br>Universidade Federal de Itajubá

</div>

# Simulador PCA - Análise de Componentes Principais

Simulador interativo passo a passo de **PCA (Principal Component Analysis / Análise de Componentes Principais)** para fins didáticos. A aplicação explica visualmente cada etapa do processo de PCA, desde os dados originais até a visualização final no novo sistema de coordenadas (PC1 × PC2).

A interface visual utiliza a mesma identidade visual do simulador de Árvore Binária de Busca (BST): https://github.com/propercioggj/PCO001-BST.

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

## 🐧 Dataset Padrão: Palmer Penguins

O simulador utiliza por padrão os dados do famoso dataset **[Palmer Penguins](https://github.com/mwaskom/seaborn-data/blob/master/penguins.csv)** (Gorman, Williams & Fraser, 2014), amplamente utilizado no ensino de Aprendizado de Máquina e Estatística.

### Análise dos Dados Escolhidos:

- **Variáveis Padrão Selecionadas:**
  - **Variável 1 (Eixo X):** `bill_length_mm` (Comprimento do Bico em mm)
  - **Variável 2 (Eixo Y):** `flipper_length_mm` (Comprimento da Nadadeira em mm)
- **Por que esta combinação é a mais didática?**
  1. **Forte Correlação Positiva ($r = 0,66$):** Existe uma relação linear clara e intuitiva entre o tamanho do bico e das nadadeiras.
  2. **Separação Natural das 3 Espécies:**
     - 🟠 **Adelie:** bicos menores (~38,8 mm) e nadadeiras menores (~190 mm);
     - 🟣 **Chinstrap:** bicos longos (~48,8 mm) e nadadeiras intermediárias (~195,8 mm);
     - 🟢 **Gentoo:** os maiores pinguins, com nadadeiras longas (~217,2 mm) e bicos grandes (~47,5 mm).
  3. **Excelente Captura pelo PC1 ($> 93\%$):**
     - Tanto na amostra didática quanto na população completa de 342 pinguins, o primeiro componente principal (**PC1**) captura **mais de 93%** de toda a variância dos dados ao longo de um ângulo ótimo de **~75° a 76°**!

### Modos de Amostragem Didática:

- **Amostra Didática (6 Pinguins - Padrão):** 2 Adelie, 2 Chinstrap e 2 Gentoo, permitindo inspeção individual na tabela e traçado limpo de cada projeção ortogonal.
- **Amostra Balanceada (15 Pinguins):** 5 de cada espécie para observar a dispersão intra e entre espécies.
- **População Completa (342 Pinguins):** Nuvem de dispersão completa com agrupamentos das 3 espécies.

---

## 📂 Importação de Outros Datasets (CSV)

O simulador permite importar qualquer outro arquivo `.csv` diretamente na interface através do botão **"Importar Novo Dataset (CSV)..."**:

- **Upload de arquivo** (`.csv`) ou colar texto CSV diretamente;
- Suporte a delimitadores por **vírgula (`,`)** ou **ponto e vírgula (`;`)**;
- Detecção automática de colunas numéricas e de texto;
- Seleção customizada de quais colunas usar para o **Eixo X** e **Eixo Y**;
- Seleção opcional de coluna de rótulo / categoria para coloração de pontos;
- Definição do tamanho da amostra (6, 12, 30 observações ou dataset completo).

---

## 🚀 Tecnologias

| Tecnologia            | Papel                                                                       |
| --------------------- | --------------------------------------------------------------------------- |
| **React 18**          | Interface reativa e componentizada                                          |
| **Canvas API**        | Renderização dos gráficos scatter com eixos, projeções e reta               |
| **Vite 5**            | Bundler e dev server                                                        |
| **JavaScript (ES6+)** | Motor PCA: cálculo de média, variância, autovalores, autovetores, projeções |
| **CSS Design System** | Mesmo tema verde ardósia do projeto Tree                                    |
| **Docker**            | Conteinerização com Nginx Alpine                                            |

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
