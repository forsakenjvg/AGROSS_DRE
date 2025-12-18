# Guia de Desenvolvimento

## Visão Geral

Este guia fornece informações detalhadas para desenvolvedores que trabalham no Dashboard DRE, incluindo configuração do ambiente, fluxos de trabalho, padrões de código e diretrizes de contribuição.

## Ambiente de Desenvolvimento

### Pré-requisitos

- **Node.js**: 18.x ou superior
- **NPM**: 8.x ou superior  
- **Git**: 2.30 ou superior
- **VS Code** (recomendado) com extensões:
  - ES7+ React/Redux/React-Native snippets
  - Prettier - Code formatter
  - ESLint
  - Auto Rename Tag
  - Bracket Pair Colorizer
  - GitLens

### Configuração do Ambiente

#### 1. Clone do Repositório

```bash
git clone <repository-url>
cd dre-dashboard
```

#### 2. Instalação de Dependências

```bash
# Instalar dependências do projeto
npm install

# Instalar dependências globais de desenvolvimento
npm install -g nodemon jest
```

#### 3. Configuração do VS Code

```bash
# Criar diretório de configuração do VS Code
mkdir .vscode

# Configurar launch.json para debug
cat > .vscode/launch.json << 'EOF'
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "program": "${workspaceFolder}/server.js",
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "runtimeExecutable": "nodemon"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
EOF

# Configurar settings.json
cat > .vscode/settings.json << 'EOF'
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "javascript.validate.enable": true,
  "emmet.includeLanguages": {
    "javascript": "javascriptreact"
  }
}
EOF
```

#### 4. Variáveis de Ambiente de Desenvolvimento

```bash
# Copiar template de ambiente
cp .env.example .env.development

# Configurar variáveis específicas de desenvolvimento
cat > .env.development << 'EOF'
NODE_ENV=development
PORT=13456
CACHE_TTL_TOKEN=3000
CACHE_TTL_DATA=1800
REQUEST_TIMEOUT=30000

# Configurações de debug
DEBUG=app:*
LOG_LEVEL=debug
EOF
```

## Scripts de Desenvolvimento

### package.json - Scripts Completos

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "debug": "node --inspect server.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint . --ext .js,.html",
    "lint:fix": "eslint . --ext .js,.html --fix",
    "format": "prettier --write .",
    "build": "npm run lint && npm run test",
    "serve": "npm run build && npm start",
    "clean": "rm -rf node_modules package-lock.json",
    "reset": "npm run clean && npm install",
    "docs": "jsdoc -c jsdoc.conf.json",
    "analyse": "npm-check-updates",
    "security": "npm audit",
    "security:fix": "npm audit fix"
  }
}
```

### Scripts Customizados

```bash
# scripts/dev-setup.sh
#!/bin/bash

echo "🚀 Configurando ambiente de desenvolvimento..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale Node.js 18+"
    exit 1
fi

echo "✅ Node.js: $(node --version)"
echo "✅ NPM: $(npm --version)"

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Verificar instalação
echo "🔍 Verificando instalação..."
npm test -- --passWithNoTests

# Configurar git hooks
echo "🪝 Configurando git hooks..."
npx husky install

echo "✅ Ambiente configurado com sucesso!"
echo ""
echo "Comandos úteis:"
echo "  npm run dev     - Iniciar servidor em modo desenvolvimento"
echo "  npm run test    - Executar testes"
echo "  npm run lint    - Verificar qualidade do código"
```

```bash
# scripts/test.sh
#!/bin/bash

echo "🧪 Executando suíte de testes..."

# Testes unitários
echo "📋 Testes unitários..."
npm run test:coverage

# Testes de integração
echo "🔗 Testes de integração..."
npm run test:integration

# Testes E2E
echo "🎭 Testes E2E..."
npm run test:e2e

# Relatório de cobertura
echo "📊 Gerando relatório de cobertura..."
open coverage/lcov-report/index.html
```

## Padrões de Código

### 1. JavaScript (Backend)

#### Estilo de Código

```javascript
// Usar camelCase para variáveis e funções
const userName = 'john_doe';
const getUserData = () => { /* ... */ };

// Usar PascalCase para classes
class DataManager {
  constructor() {
    this.cache = new Map();
  }
}

// Usar UPPER_SNAKE_CASE para constantes
const API_BASE_URL = 'https://api.example.com';
const DEFAULT_TIMEOUT = 30000;

// Funções assíncronas devem ter prefixo async
async function fetchData(endpoint) {
  try {
    const response = await fetch(endpoint);
    return await response.json();
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}
```

#### Estrutura de Módulos

```javascript
// modules/api-client.js
class APIClient {
  constructor(options = {}) {
    this.baseURL = options.baseURL || process.env.API_BASE_URL;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      timeout: this.timeout,
      headers: { ...this.headers, ...options.headers },
      ...options
    };

    try {
      const response = await fetch(url, config);
      return await this.handleResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async handleResponse(response) {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  }

  handleError(error) {
    console.error('API Error:', error);
    throw error;
  }
}

module.exports = APIClient;
```

#### Validação de Input

```javascript
// utils/validation.js
class Validator {
  static validateDate(dateString) {
    if (!dateString) {
      throw new Error('Data é obrigatória');
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error('Data inválida');
    }
    
    return date;
  }

  static validatePositiveNumber(value, fieldName) {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      throw new Error(`${fieldName} deve ser um número positivo`);
    }
    return num;
  }

  static validateRequired(value, fieldName) {
    if (!value || value.trim() === '') {
      throw new Error(`${fieldName} é obrigatório`);
    }
    return value.trim();
  }
}

module.exports = Validator;
```

### 2. HTML/Frontend

#### Estrutura Semântica

```html
<!-- Usar HTML5 semântico -->
<main class="container">
  <section class="dashboard-section">
    <header class="section-header">
      <h1>Dashboard DRE</h1>
      <p>Visualização de resultados financeiros</p>
    </header>
    
    <article class="chart-container">
      <h2>Análise por Departamento</h2>
      <figure>
        <canvas id="departmentChart"></canvas>
        <figcaption>Distribuição de receitas por departamento</figcaption>
      </figure>
    </article>
  </section>
</main>
```

#### Acessibilidade

```html
<!-- Labels e ARIA -->
<div class="form-group">
  <label for="dataInicio" class="form-label">
    Data Início
    <span class="required" aria-label="Campo obrigatório">*</span>
  </label>
  <input 
    type="date" 
    id="dataInicio" 
    class="form-control"
    aria-required="true"
    aria-describedby="dataInicioHelp"
  >
  <small id="dataInicioHelp" class="form-text text-muted">
    Selecione a data inicial do período
  </small>
</div>

<!-- Navegação por teclado -->
<button 
  type="button" 
  class="btn btn-primary"
  onclick="handleFilterSubmit()"
  aria-label="Aplicar filtros de data e departamento"
>
  <i class="fas fa-search" aria-hidden="true"></i>
  Aplicar Filtros
</button>
```

### 3. CSS

#### Organização e Metodologia BEM

```css
/* Block */
.dashboard {
  padding: 2rem;
  background: #f8f9fa;
}

/* Element */
.dashboard__header {
  margin-bottom: 2rem;
  text-align: center;
}

.dashboard__title {
  font-size: 2rem;
  font-weight: 700;
  color: #212529;
}

/* Modifier */
.dashboard--loading {
  opacity: 0.6;
  pointer-events: none;
}

.dashboard__header--compact {
  margin-bottom: 1rem;
}

/* State */
.dashboard__filter {
  transition: all 0.3s ease;
}

.dashboard__filter:focus {
  border-color: #0d6efd;
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
}
```

#### CSS Custom Properties

```css
:root {
  /* Cores do tema */
  --primary-color: #0d6efd;
  --secondary-color: #6c757d;
  --success-color: #198754;
  --warning-color: #ffc107;
  --danger-color: #dc3545;
  --info-color: #0dcaf0;
  
  /* Escala de cinza */
  --gray-100: #f8f9fa;
  --gray-200: #e9ecef;
  --gray-300: #dee2e6;
  --gray-400: #ced4da;
  --gray-500: #adb5bd;
  --gray-600: #6c757d;
  --gray-700: #495057;
  --gray-800: #343a40;
  --gray-900: #212529;
  
  /* Tipografia */
  --font-family-base: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  --font-size-base: 1rem;
  --line-height-base: 1.6;
  
  /* Espaçamento */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-xxl: 3rem;
  
  /* Sombras */
  --shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  --shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
  --shadow-lg: 0 1rem 3rem rgba(0, 0, 0, 0.175);
  
  /* Transições */
  --transition-fast: 0.15s ease-in-out;
  --transition-normal: 0.3s ease-in-out;
  --transition-slow: 0.5s ease-in-out;
}
```

## Fluxos de Trabalho

### 1. Fluxo Git

#### Branch Strategy

```bash
# Branch principal
main        # Produção (merge only via pull request)
develop     # Desenvolvimento (branch de integração)

# Feature branches
feature/nome-da-feature    # Novas funcionalidades
bugfix/nome-do-bug         # Correções de bugs
hotfix/nome-do-hotfix      # Correções críticas em produção
release/vX.Y.Z             # Preparação de releases
```

#### Workflow de Desenvolvimento

```bash
# 1. Atualizar branch develop
git checkout develop
git pull origin develop

# 2. Criar feature branch
git checkout -b feature/nova-funcionalidade

# 3. Desenvolver e fazer commits
git add .
git commit -m "feat: adicionar gráfico de pizza para distribuição departamental"

# 4. Push e criar pull request
git push origin feature/nova-funcionalidade
# Criar PR no GitHub/GitLab

# 5. Após aprovação e merge
git checkout develop
git pull origin develop
git branch -d feature/nova-funcionalidade
```

#### Convenções de Commit

```bash
# Formato: <type>(<scope>): <description>

# Types
feat:     Nova funcionalidade
fix:      Correção de bug
docs:     Documentação
style:    Formatação/estilo (sem mudança de código)
refactor: Refatoração
test:     Testes
chore:    Tarefas de build/maintenance

# Examples
feat(api): adicionar endpoint de resumo DRE
fix(frontend): corrigir bug em filtros de data
docs(readme): atualizar instruções de instalação
style(css): ajustar espaçamento dos cards
refactor(cache): otimizar lógica de cache
test(unit): adicionar testes para API client
chore(deps): atualizar dependências
```

### 2. Processo de Code Review

#### Checklist de Review

**Funcionalidade:**
- [ ] Funcionalidade atende aos requisitos
- [ ] Testes cobrem os casos principais
- [ ] Tratamento de erros implementado
- [ ] Performance avaliada

**Qualidade de Código:**
- [ ] Código limpo e legível
- [ ] Segue padrões do projeto
- [ ] Comentários quando necessário
- [ ] Sem código duplicado

**Segurança:**
- [ ] Validação de inputs
- [ ] Sanitização de dados
- [ ] Sem hardcoding de credenciais
- [ ] Verificação de permissões

**Testes:**
- [ ] Testes unitários escritos
- [ ] Testes de integração quando aplicável
- [ ] Cobertura de código adequada
- [ ] Testes passam no CI/CD

#### Template de Pull Request

```markdown
## Descrição
Breve descrição da mudança implementada.

## Tipo de Mudança
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist
- [ ] Meu código segue as diretrizes de estilo do projeto
- [ ] Realizei auto-revisão do meu código
- [ ] Adicionei comentários quando necessário
- [ ] Minhas mudanças não geram novos warnings
- [ ] Adicionei testes que provam que minha correção funciona
- [ ] Testes novos e existentes passam
- [ ] Documentei as mudanças relevantes

## Como Testar
Passos para testar a funcionalidade implementada.

## Screenshots
Se aplicável, adicionar screenshots da funcionalidade.

## Issue Relacionada
Closes #<issue_number>
```

### 3. Testes

#### Estrutura de Testes

```
tests/
├── unit/                   # Testes unitários
│   ├── api/               # Testes da API
│   ├── utils/             # Testes de utilitários
│   └── services/          # Testes de serviços
├── integration/            # Testes de integração
│   ├── api.test.js        # Testes de endpoints
│   └── database.test.js   # Testes com banco
├── e2e/                   # Testes end-to-end
│   ├── dashboard.test.js   # Fluxos completos
│   └── reports.test.js    # Geração de relatórios
├── fixtures/              # Dados de teste
│   ├── users.json
│   └── dre-data.json
└── helpers/               # Helpers de teste
    ├── setup.js
    └── auth.js
```

#### Exemplo de Testes Unitários

```javascript
// tests/unit/api/api-client.test.js
const APIClient = require('../../../modules/api-client');
const { mockFetch } = require('../../helpers/fetch-mock');

describe('APIClient', () => {
  let apiClient;

  beforeEach(() => {
    apiClient = new APIClient({
      baseURL: 'http://test-api.com',
      timeout: 5000
    });
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('request', () => {
    it('deve fazer requisição GET com sucesso', async () => {
      const mockResponse = { success: true, data: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiClient.request('/test');

      expect(fetch).toHaveBeenCalledWith(
        'http://test-api.com/test',
        expect.objectContaining({
          method: 'GET',
          timeout: 5000
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('deve tratar erro HTTP 4xx/5xx', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(apiClient.request('/not-found'))
        .rejects.toThrow('HTTP 404: Not Found');
    });

    it('deve tratar erro de rede', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network Error'));

      await expect(apiClient.request('/test'))
        .rejects.toThrow('Network Error');
    });
  });
});
```

#### Testes de Integração

```javascript
// tests/integration/api/dre.test.js
const request = require('supertest');
const app = require('../../../server');

describe('API DRE Integration', () => {
  let server;

  beforeAll(() => {
    server = app.listen(0); // Porta aleatória
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('GET /api/dre/summary', () => {
    it('deve retornar resumo DRE com filtros válidos', async () => {
      const response = await request(app)
        .get('/api/dre/summary')
        .query({
          dataInicio: '2024-01-01',
          dataFim: '2024-12-31'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('deve retornar erro para parâmetros inválidos', async () => {
      const response = await request(app)
        .get('/api/dre/summary')
        .query({
          dataInicio: 'invalid-date'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });
});
```

#### Configuração do Jest

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'server.js',
    'modules/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.js'],
  testTimeout: 10000
};
```

## Deploy e DevOps

### 1. CI/CD Pipeline

#### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linting
        run: npm run lint
      
      - name: Run tests
        run: npm run test:coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run security audit
        run: npm audit --audit-level moderate

  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18.x'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci --production
      
      - name: Build Docker image
        run: |
          docker build -t dre-dashboard:${{ github.sha }} .
          docker tag dre-dashboard:${{ github.sha }} dre-dashboard:latest
      
      - name: Push to registry
        if: github.ref == 'refs/heads/main'
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push dre-dashboard:${{ github.sha }}
          docker push dre-dashboard:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Deploy to production
        run: |
          # Comandos de deploy para seu ambiente
          echo "Deploying to production..."
```

### 2. Docker

#### Dockerfile Multistage

```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Run tests
RUN npm run test

# Stage 2: Production
FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set work directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app .

# Change to app user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:13456/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Expose port
EXPOSE 13456

# Start application
CMD ["npm", "start"]
```

#### Docker Compose para Desenvolvimento

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "13456:13456"
      - "9229:9229"  # Debug port
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - DEBUG=app:*
    command: npm run debug
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

### 3. Monitoramento

#### Health Checks Customizados

```javascript
// utils/health-check.js
class HealthChecker {
  constructor() {
    this.checks = new Map();
  }

  addCheck(name, checkFunction) {
    this.checks.set(name, checkFunction);
  }

  async runAllChecks() {
    const results = {};
    
    for (const [name, checkFunction] of this.checks) {
      try {
        const startTime = Date.now();
        const result = await checkFunction();
        const duration = Date.now() - startTime;
        
        results[name] = {
          status: 'healthy',
          duration,
          ...result
        };
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }
    
    return results;
  }
}

// Uso
const healthChecker = new HealthChecker();

healthChecker.addCheck('database', async () => {
  // Verificar conexão com banco de dados
  return { connected: true };
});

healthChecker.addCheck('external-api', async () => {
  // Verificar API externa
  return { available: true };
});

// Endpoint de health
app.get('/api/health/detailed', async (req, res) => {
  const checks = await healthChecker.runAllChecks();
  const overallStatus = Object.values(checks).every(check => check.status === 'healthy');
  
  res.status(overallStatus ? 200 : 503).json({
    status: overallStatus ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks
  });
});
```

## Debugging e Troubleshooting

### 1. Debug do Backend

#### Debug com Node.js Inspector

```bash
# Iniciar com debugger
npm run debug

# Ou com breakpoints específicos
node --inspect-brk server.js

# Conectar VS Code debugger
# F5 ou Menu > Run > Start Debugging
```

#### Logging Estruturado

```javascript
// utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'dre-dashboard' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

### 2. Debug do Frontend

#### Debug Tools no Browser

```javascript
// Debug mode
if (process.env.NODE_ENV === 'development') {
  window.DRE_DEBUG = {
    state: appState,
    api: apiClient,
    charts: appState.charts,
    
    // Funções de debug
    clearCache: () => apiClient.clearCache(),
    exportState: () => JSON.stringify(appState, null, 2),
    logPerformance: () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      console.log('Page Load Time:', navigation.loadEventEnd - navigation.loadEventStart);
    }
  };
  
  console.log('🔧 Debug mode enabled. Use window.DRE_DEBUG');
}
```

#### Network Tab Debugging

```javascript
// Request interceptor para debug
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const [url, options] = args;
  const startTime = Date.now();
  
  console.log(`🚀 API Request: ${options?.method || 'GET'} ${url}`);
  
  try {
    const response = await originalFetch(...args);
    const duration = Date.now() - startTime;
    
    console.log(`✅ API Response: ${response.status} (${duration}ms)`);
    
    // Log response data for debugging
    if (url.includes('/api/')) {
      const clone = response.clone();
      const data = await clone.json();
      console.log('📊 Response Data:', data);
    }
    
    return response;
  } catch (error) {
    console.error(`❌ API Error: ${error.message}`);
    throw error;
  }
};
```

## Boas Práticas

### 1. Performance

#### Backend

```javascript
// Connection pooling para banco de dados
const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Cache middleware
function cacheMiddleware(ttl = 300) {
  return (req, res, next) => {
    const key = `cache:${req.originalUrl}`;
    
    // Try to get from cache
    client.get(key, (err, data) => {
      if (!err && data) {
        return res.json(JSON.parse(data));
      }
      
      // Continue and cache response
      const originalJson = res.json;
      res.json = function(data) {
        client.setex(key, ttl, JSON.stringify(data));
        return originalJson.call(this, data);
      };
      
      next();
    });
  };
}
```

#### Frontend

```javascript
// Component lazy loading
const LazyChart = lazy(() => import('./components/Chart'));

// Memoização de componentes
const ExpensiveComponent = React.memo(({ data }) => {
  // Renderização pesada
  return <Chart data={processData(data)} />;
}, (prevProps, nextProps) => {
  return prevProps.data.length === nextProps.data.length;
});

// Virtual scrolling
function useVirtualScrolling(items, itemHeight, containerHeight) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    items.length - 1,
    visibleStart + Math.ceil(containerHeight / itemHeight)
  );
  
  const visibleItems = items.slice(visibleStart, visibleEnd + 1);
  const offsetY = visibleStart * itemHeight;
  
  return {
    visibleItems,
    offsetY,
    onScroll: (e) => setScrollTop(e.target.scrollTop)
  };
}
```

### 2. Segurança

```javascript
// Input sanitization
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .trim();
};

// Rate limiting
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later'
  }
});

app.use('/api/', apiLimiter);
```

### 3. Documentação

#### JSDoc para Código

```javascript
/**
 * Busca dados da DRE com filtros opcionais
 * 
 * @param {Object} filters - Filtros para consulta
 * @param {string} filters.dataInicio - Data inicial no formato YYYY-MM-DD
 * @param {string} filters.dataFim - Data final no formato YYYY-MM-DD
 * @param {string} [filters.departamento] - Filtro por departamento
 * @param {string} [filters.linhaDRE] - Filtro por linha DRE
 * @param {number} [page=1] - Número da página (paginação)
 * @param {number} [limit=50] - Registros por página
 * 
 * @returns {Promise<Object>} Dados da DRE paginados
 * 
 * @throws {ValidationError} Se parâmetros obrigatórios forem inválidos
 * @throws {APIError} Se ocorrer erro na comunicação com o ERP
 * 
 * @example
 * const data = await getDREData({
 *   dataInicio: '2024-01-01',
 *   dataFim: '2024-12-31',
 *   departamento: 'COMERCIAL'
 * }, 1, 100);
 */
async function getDREData(filters, page = 1, limit = 50) {
  // Implementação
}
```

## Conclusão

Este guia de desenvolvimento fornece uma base sólida para manter a qualidade e consistência do código no Dashboard DRE. Seguindo essas diretrizes, os desenvolvedores podem:

- **Produzir código de alta qualidade** com padrões consistentes
- **Trabalhar eficientemente** com fluxos de trabalho otimizados  
- **Manter a aplicação robusta** com testes abrangentes
- **Garantir performance** e segurança em produção
- **Colaborar efetivamente** com documentação clara

O documento deve ser atualizado regularmente conforme a aplicação evolui e novas melhores práticas são adotadas.
