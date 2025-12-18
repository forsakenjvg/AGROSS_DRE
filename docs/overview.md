# Dashboard DRE - Visão Geral do Sistema

## O que é o Dashboard DRE?

O Dashboard DRE (Demonstração de Resultados do Exercício) é uma aplicação web interativa desenvolvida para a AGROSS que exibe dados financeiros e contábeis de forma visual e intuitiva. O sistema se conecta a um ERP externo via REST API para buscar e processar dados contábeis em tempo real.

### Propósito Principal

- **Visualização de Dados Financeiros**: Apresentar dados da DRE através de gráficos e tabelas interativas
- **Análise de Desempenho**: Permitir análise por períodos, departamentos e categorias contábeis
- **Tomada de Decisão**: Fornecer informações estratégicas para gestão financeira
- **Integração ERP**: Conectar-se diretamente ao sistema ERP da empresa sem necessidade de exportação manual de dados

## Características Principais

### 📊 Visualizações Interativas
- Gráficos de barras e linhas usando Chart.js
- Tabelas detalhadas com dados paginados
- Filtros dinâmicos por data, departamento e linha DRE
- Responsividade para desktop e mobile

### 🔗 Integração com ERP
- Conexão REST API com sistema ERP externo
- Autenticação automática com cache de tokens
- Cache inteligente de dados para melhor performance
- Tratamento robusto de erros e timeouts

### 🏢 Organização por Departamentos
O sistema categoriza os dados nos seguintes departamentos:
- ADM.FINANCEIRO
- COMERCIAL
- DIRECAO
- GENTE E GESTAO
- ENGENHARIA
- PRODUCAO
- SUPPLY CHAIN
- POS VENDA
- NAO CLASSIFICADO

### 📈 Categorias DRE
Os dados são organizados em 9 categorias principais:
1. **RECEITA OPERACIONAL LIQUIDA** (códigos 311, 312)
2. **CPV/CMV/CSP** (código 321)
3. **DESPESAS OPERACIONAIS** (códigos 32201, 32202)
4. **OUTRAS RECEITAS OPERACIONAIS** (códigos 313, 314)
5. **OUTRAS DESPESAS OPERACIONAIS** (código 32205)
6. **RECEITAS FINANCEIRAS** (código 32301)
7. **DESPESAS FINANCEIRAS** (código 32303)
8. **RESULTADO NAO OPERACIONAL** (códigos 324, 3229901)
9. **PROVISAO PARA IR E CSLL**

## Tecnologias Utilizadas

### Backend
- **Node.js**: Runtime JavaScript
- **Express.js**: Framework web para API REST
- **Axios**: Cliente HTTP para comunicação com ERP
- **Node-Cache**: Sistema de cache em memória
- **Helmet**: Segurança HTTP
- **Compression**: Compressão de respostas
- **CORS**: Compartilhamento de recursos entre origens

### Frontend
- **HTML5**: Estrutura semântica
- **Bootstrap 5.3**: Framework CSS responsivo
- **Chart.js**: Biblioteca de visualização de dados
- **JavaScript Vanilla**: Lógica interativa
- **Font Awesome**: Ícones vetoriais

## Fluxo de Dados

1. **Frontend** → Requisição para API local com filtros
2. **Server** → Verifica cache de dados disponível
3. **Se cache inválido** → Autentica no ERP (se necessário)
4. **Server** → Executa consulta SQL via REST API do ERP
5. **ERP** → Retorna dados brutos
6. **Server** → Processa, categoriza e cacheia os dados
7. **Frontend** → Recebe dados e renderiza visualizações

## Performance e Cache

O sistema implementa duas estratégias principais de cache:

### Cache de Autenticação
- **Duração**: 50 minutos
- **Finalidade**: Evitar re-autenticação frequente no ERP
- **Armazenamento**: Token JWT em memória

### Cache de Dados
- **Duração**: 30 minutos  
- **Finalidade**: Reduzir carga no ERP e melhorar tempo de resposta
- **Armazenamento**: Dados consultados em memória com chaves baseadas nos filtros

## Segurança

- **Helmet**: Proteção contra vulnerabilidades HTTP comuns
- **CORS**: Restrição de origens permitidas
- **Variáveis de Ambiente**: Configurações sensíveis separadas do código
- **Rate Limiting**: Prevenção contra sobrecarga (implantação futura)

## Deploy e Operação

O sistema é projetado para operação contínua com:
- **Auto-restart**: Via process managers (PM2, Docker, etc.)
- **Logs**: Console logging com níveis de severidade
- **Health Check**: Endpoint `/api/health` para monitoramento
- **Cache Management**: Endpoint para limpeza manual de cache

## Benefícios para o Negócio

### Para Gestores
- **Visão 360°**: Visão completa dos resultados financeiros
- **Decisões Baseadas em Dados**: Informações em tempo real
- **Análise Comparativa**: Por períodos e departamentos

### Para Equipes Financeiras
- **Automatização**: Redução de trabalho manual
- **Confiabilidade**: Dados diretos da fonte (ERP)
- **Agilidade**: Atualizações instantâneas sem processamento manual

### Para TI
- **Manutenção Simplificada**: Arquitetura modular
- **Performance**: Cache inteligente e otimizações
- **Escalabilidade**: Pronto para crescimento e novas funcionalidades
