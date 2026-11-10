# Especificação Arquitetural e Roadmap: ConsultoraSync

> **Plano anterior — revisão pendente após a descoberta de 09/11/2026.** O [briefing atual](../_bmad-output/planning-artifacts/briefs/brief-consultorasync-2026-11-09/brief.md) define o primeiro teste de clientes, pedidos, estoque e contas/pagamentos. Tecnologias, modelo de dados, integrações, custo, desempenho e fases abaixo precisam de reconciliação antes da implementação.

## 1. Visão Geral do Sistema
O **ConsultoraSync** é um software de suporte à operação e tomada de decisão para revendedoras autônomas de venda direta e cosméticos por catálogo.

### Premissas Fundamentais:
1. **Zero Custo de Infraestrutura**: Uso exclusivo de camadas gratuitas (*free tiers*) sem necessidade de cartão internacional.
2. **Entrada de Dados Ágil**: Eliminação da digitação manual de produtos via câmera do celular (código de barras EAN-13 e Nota Fiscal/DANFE).
3. **Independência de Entrevistas em Massa**: Validação acadêmica embasada em heurísticas de usabilidade (Nielsen) e suíte de testes automatizados de cálculo financeiro.

---

## 2. Roadmap Evolutivo (3 Fases)

```mermaid
flowchart LR
    F1["Fase 1 (MVP)\n• Leitor EAN-13 via Câmera\n• Open Beauty Facts API\n• Estoque Pronta-Entrega & Validades\n• Vendas & Régua WhatsApp"] 
    --> F2["Fase 2 (Automação Fiscal)\n• Parser de DANFE (PDF/XML)\n• Captura de Custo Unitário com Desconto\n• Rateio Proporcional do Frete"]
    --> F3["Fase 3 (Catálogo & Ciclos)\n• Scraper de Revistas Digitais\n• Sincronização de Ciclos e Promoções\n• Mini-Loja Pública Web"]
```

---

## 3. Arquitetura de Integração com o Celular

### Comparativo de Abordagens de Escaneamento

| Critério | Abordagem 1: PWA Web Puro | Abordagem 2: Híbrido com Capacitor (APK) | Abordagem 3: Companion Scanner (WebSockets) |
|---|---|---|---|
| **Como o Celular Conecta** | Acesso pelo navegador mobile (Chrome/Safari) | Aplicativo `.apk` instalado no Android | Lê QR Code na tela do PC para parear |
| **Acesso à Câmera** | `navigator.mediaDevices.getUserMedia` | Plugin Nativo Capacitor + Google ML Kit | Câmera do smartphone via WebRTC / Canvas |
| **Velocidade de Leitura** | 300ms a 600ms | < 100ms (Acelerado por hardware) | Instantânea via WebSocket |
| **Instalação** | Nenhuma (atalho de tela) | Arquivo `.apk` local | Nenhuma (navegador mobile) |
| **Papel no Projeto** | Modo alternativo web | **Versão Final de Produção** | **Fase de Testes Inicial** |

> **Decisão**: A fase de validação imediata adota a **Abordagem 3 (Companion Scanner)** para testar o escaneamento físico sem atrito de compilação. Em seguida, a solução evolui para a **Abordagem 2 (Capacitor/APK)**.

---

## 4. Diagrama de Contêineres (Modelo C4)

```mermaid
flowchart TB
    Consultora["Consultora / Revendedora\n(Celular Smartphone)"]
    Cliente["Cliente Final\n(WhatsApp)"]

    subgraph Frontend["Frontend Web & PWA (Vercel)"]
        UI["Interface React / Next.js\n• Leitor html5-qrcode\n• Dashboard de Vendas e Estoque\n• Cache Local IndexedDB"]
    end

    subgraph Backend["Backend API (Render / Fly.io)"]
        API["FastAPI (Python) ou NestJS (Node.js)\n• WebSocket Hub (Pareamento em Tempo Real)\n• Parser de DANFE (PDF/XML)\n• Motor Financeiro de Rateio e Margens"]
    end

    subgraph Database["Armazenamento (Supabase Free Tier)"]
        PG[("PostgreSQL\n• Catálogo Global de Cosméticos\n• Lotes de Estoque\n• Vendas e Parcelas")]
        Storage["Supabase Storage\n(Fotos de Produtos)"]
    end

    subgraph External["Serviços Externos"]
        OBF["Open Beauty Facts API\n(Busca EAN Gratuita)"]
        WPP["WhatsApp Deep Link (wa.me)"]
    end

    Consultora -->|Escaneia produtos na câmera| UI
    UI <-->|WebSockets (Tempo Real)| API
    UI -->|REST / HTTPS| API
    API <--> PG
    API <--> Storage
    API -->|Fallback EAN| OBF
    UI -->|Dispara cobrança Pix| WPP
    WPP -.->|Mensagem| Cliente
```

---

## 5. Diagramas de Sequência

### 5.1 Escaneamento via Companion Scanner (Abordagem 3)
```mermaid
sequenceDiagram
    autonumber
    actor Dev as Usuário no PC
    participant PC as Tela do Dashboard (PC)
    participant Server as Servidor Node / WebSockets
    participant Cel as Navegador do Celular
    participant OBF as Open Beauty Facts API

    Dev->>PC: Abre o Dashboard no navegador
    PC->>Server: Inicia sessão (Gera Session ID)
    Server-->>PC: Renderiza QR Code de conexão
    Dev->>Cel: Escaneia o QR Code com a câmera do celular
    Cel->>Server: Conecta WebSocket na mesma sessão
    Server-->>PC: Atualiza status: "Celular Conectado"
    Dev->>Cel: Aponta a câmera para o código EAN de um produto
    Cel->>Cel: Decodifica código EAN-13, bipa e vibra
    Cel->>Server: Envia { sessionId, ean }
    Server->>OBF: Consulta metadados (Nome, Marca, Foto)
    OBF-->>Server: Retorna dados do cosmético
    Server-->>PC: Notifica produto escaneado via WebSocket
    PC->>Dev: Toca som de confirmação e exibe produto no estoque
```

### 5.2 Ingestão de Nota Fiscal / DANFE (Fase 2)
```mermaid
sequenceDiagram
    autonumber
    actor Dev as Consultora
    participant PWA as Interface PWA
    participant Parser as Parser DANFE (Backend)
    participant DB as Banco PostgreSQL

    Dev->>PWA: Faz upload do PDF da DANFE ou digita chave de 44 dígitos
    PWA->>Parser: POST /api/v1/nfe/processar
    Parser->>Parser: Identifica CNPJ da marca (Natura / Boticário)
    Parser->>Parser: Extrai itens, códigos EAN, quantidades e valores faturados
    Parser->>Parser: Extrai valor do frete total da caixa
    Parser->>Parser: Executa algoritmo de rateio ponderado do frete
    Parser-->>PWA: Retorna lista de conferência com custo unitário real
    Dev->>PWA: Clica em "Confirmar Entrada no Estoque"
    PWA->>DB: Persiste novo lote com histórico fiscal
```

---

## 6. Modelo Relacional de Dados

```mermaid
erDiagram
    USUARIO ||--o{ PRODUTO_ESTOQUE : possui
    USUARIO ||--o{ CLIENTE : atende
    CLIENTE ||--o{ VENDA : realiza
    VENDA ||--o{ ITEM_VENDA : contem
    VENDA ||--o{ PARCELA : gera
    PRODUTO_ESTOQUE ||--o{ ITEM_VENDA : abastece
    CATALOGO_GLOBAL ||--o{ PRODUTO_ESTOQUE : referencia
    NOTA_FISCAL_ENTRADA ||--o{ PRODUTO_ESTOQUE : originou

    CATALOGO_GLOBAL {
        string ean_13 PK
        string nome
        string marca
        string categoria
        string foto_url
        timestamp criado_em
    }

    PRODUTO_ESTOQUE {
        uuid id PK
        uuid usuario_id FK
        string ean_13 FK
        uuid nota_fiscal_id FK
        decimal preco_custo_liquido
        decimal preco_venda_sugerido
        int quantidade_disponivel
        date data_validade
        string lote
    }

    VENDA {
        uuid id PK
        uuid usuario_id FK
        uuid cliente_id FK
        decimal valor_total
        decimal taxa_maquininha_descontada
        decimal lucro_liquido_real
        string forma_pagamento
        timestamp data_venda
    }

    PARCELA {
        uuid id PK
        uuid venda_id FK
        int numero_parcela
        decimal valor
        date data_vencimento
        date data_pagamento
        string status
    }

    NOTA_FISCAL_ENTRADA {
        uuid id PK
        uuid usuario_id FK
        string chave_nfe_44_digitos
        string marca_emitente
        decimal valor_total_nota
        decimal valor_frete_total
        timestamp data_emissao
    }
```

---

## 7. Estratégia de Verificação para Banca de TCC

1. **Testes Unitários de Regras de Negócio**:
   - Algoritmo de rateio proporcional de frete da nota fiscal (garantia de precisão monetária de 2 casas decimais sem dízimas periódicas).
   - Cálculo de margem líquida real deduzindo taxas de operadoras de cartão.
   - Validador e normalizador de código de barras EAN-13 (dígito verificador ponderado).
2. **Avaliação Heurística de Usabilidade (Nielsen)**:
   - Aplicação das 10 Heurísticas de Nielsen com 1 ou 2 revendedoras reais.
   - Comparação cronometrada: tempo de cadastro de 5 produtos via câmera vs. digitação manual.
