---
name: Atlas Eye CRM
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#424754'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#727785'
  outline-variant: '#c2c6d6'
  surface-tint: '#005ac2'
  primary: '#0058be'
  on-primary: '#ffffff'
  primary-container: '#2170e4'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#575e70'
  on-secondary: '#ffffff'
  secondary-container: '#d9dff5'
  on-secondary-container: '#5c6274'
  tertiary: '#555c6a'
  on-tertiary: '#ffffff'
  tertiary-container: '#6e7583'
  on-tertiary-container: '#fefcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#dce2f7'
  secondary-fixed-dim: '#c0c6db'
  on-secondary-fixed: '#141b2b'
  on-secondary-fixed-variant: '#404758'
  tertiary-fixed: '#dce2f3'
  tertiary-fixed-dim: '#c0c7d6'
  on-tertiary-fixed: '#151c27'
  on-tertiary-fixed-variant: '#404754'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
  border-subtle: '#E5E7EB'
  surface-white: '#FFFFFF'
  accent-yellow: '#F9F506'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  headline-md-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1440px
  margin-desktop: 32px
  margin-tablet: 24px
  margin-mobile: 16px
  gutter: 20px
  component-gap: 12px
---

## Brand & Style

O sistema de design é fundamentado em uma estética **Minimalista e Corporativa Moderna**, projetada especificamente para um ambiente de CRM de alta performance. O objetivo principal é reduzir a carga cognitiva, permitindo que o usuário foque na gestão de dados e relacionamentos sem distrações visuais desnecessárias.

A personalidade da marca é profissional, eficiente e confiável. O design utiliza um layout "limpo" com amplo espaço negativo (whitespace), tipografia nítida e uma hierarquia visual clara. A experiência do usuário deve evocar uma sensação de controle, organização e agilidade técnica.

## Colors

A paleta de cores é centrada no Azul Vibrante (`#3B82F6`), que atua como o principal motor de ação e marcação de status ativo. O fundo utiliza variações de branco e cinza extremamente claro para criar uma separação sutil entre as áreas de navegação e as áreas de conteúdo.

- **Primária:** Usada para botões de ação principal, links de navegação ativos e indicadores de progresso.
- **Neutros:** O fundo geral utiliza `#F9FAFB`, enquanto as superfícies de cartões e áreas de trabalho utilizam o branco puro (`#FFFFFF`) para máximo contraste com o texto.
- **Bordas:** O cinza `#E5E7EB` é o padrão para divisores e contornos de componentes, mantendo a interface leve.
- **Sotaque:** O amarelo extraído da marca original (`#F9F506`) deve ser usado com extrema parcimônia, apenas para alertas de atenção ou destaques secundários que exijam diferenciação cromática.

## Typography

A tipografia utiliza exclusivamente a família **Inter**, uma fonte sans-serif otimizada para legibilidade em telas e interfaces densas em dados. 

- **Títulos:** Devem utilizar o peso *Semibold* (600) para estabelecer uma hierarquia forte e imediata.
- **Corpo de Texto:** Utiliza o peso *Regular* (400) para garantir conforto na leitura de longas listas de clientes ou descrições de atividades.
- **Labels e Metadados:** Devem utilizar o peso *Medium* (500) em tamanhos reduzidos (12px) para distinguir rótulos de campos de formulário e informações de suporte.
- **Escalabilidade:** Em dispositivos móveis, os títulos grandes devem ser reduzidos proporcionalmente para evitar quebras de linha excessivas.

## Layout & Spacing

Este sistema utiliza um modelo de **Grade Fluida** com margens fixas para garantir que as tabelas de dados e dashboards de CRM aproveitem ao máximo o espaço horizontal disponível em telas grandes.

- **Estrutura:** O layout principal é composto por uma barra lateral de navegação fixa (Sidebar) de 260px e uma área de conteúdo flexível.
- **Ritmo Vertical:** Baseado em múltiplos de 4px e 8px. Espaçamentos entre cartões de 24px e entre elementos internos de componentes de 12px.
- **Breakpoints:** 
  - Desktop (>1024px): 12 colunas.
  - Tablet (768px - 1023px): 8 colunas, barra lateral colapsável.
  - Mobile (<767px): 4 colunas, margens reduzidas para 16px.

## Elevation & Depth

A profundidade é comunicada através de **Camadas Tonais** e bordas sutis, evitando sombras pesadas para manter a estética limpa.

- **Nível 0 (Fundo):** Cor `#F9FAFB`. É a base da aplicação.
- **Nível 1 (Cartões/Superfícies):** Cor `#FFFFFF` com borda sólida de 1px em `#E5E7EB`. Esta é a superfície principal para conteúdos de CRM, como perfis de clientes e feeds de atividades.
- **Nível 2 (Popovers/Modais):** Superfície branca com uma sombra de ambiente extra-difundida (Blur 15px, Opacidade 5%, Cor `#000000`) para indicar sobreposição e foco.
- **Interatividade:** Estados de *hover* em elementos clicáveis devem ser indicados por uma mudança sutil no fundo (ex: cinza claro `#F3F4F6`) em vez de elevação por sombra.

## Shapes

O sistema adota uma linguagem de formas **Arredondada**, equilibrando o rigor corporativo com uma interface amigável.

- **Componentes Padrão:** Botões, campos de input e pequenos blocos de informação utilizam o raio de 0.5rem (8px).
- **Cartões e Containers:** Para áreas maiores de conteúdo, utiliza-se `rounded-lg` (16px) para criar uma distinção clara entre a estrutura do layout e o conteúdo interno.
- **Avatares e Badges:** Devem ser circulares (pill-shaped) para se diferenciarem visualmente dos elementos de interação de dados.

## Components

### Botões
- **Primário:** Fundo `#3B82F6`, texto branco, sem sombra, cantos 8px.
- **Secundário:** Fundo branco, borda `#E5E7EB`, texto `#111827`.
- **Estados:** *Hover* com leve escurecimento da cor de fundo.

### Campos de Entrada (Inputs)
- Borda sólida `#E5E7EB`, fundo `#FFFFFF`.
- Texto de placeholder em `#9CA3AF`.
- Foco (Focus): Borda muda para `#3B82F6` com um anel de brilho (ring) sutil de 2px.

### Cartões (Cards)
- Fundo branco puro, borda cinza `#E5E7EB`, raio de 12px.
- Cabeçalhos de cartões com borda inferior separadora para organizar metadados.

### Ícones
- Estilo **Linear (Outline)**, espessura de 1.5px ou 2px.
- Cor padrão: `#6B7280`. Cor ativa: `#3B82F6`.
- Devem ser leves e nunca preenchidos, exceto para estados de erro ou sucesso crítico.

### Chips e Badges
- Utilizados para status (ex: "Em Negociação", "Fechado").
- Fundo em tons pastéis com texto em cor sólida para garantir legibilidade sem sobrecarregar visualmente a interface.

### Tabelas de Dados
- Linhas com separação sutil em `#F3F4F6`.
- Cabeçalhos em `label-md` com fundo levemente acinzentado para fixação visual.