# API Reference - Dashboard DRE

## Visão Geral

O Dashboard DRE expõe uma API RESTful para acesso aos dados financeiros e administrativos. A API é projetada para consumo pelo frontend, mas também pode ser utilizada por outras aplicações cliente.

### Informações Básicas

- **Base URL**: `http://localhost:13456/api` (desenvolvimento)
- **Content-Type**: `application/json`
- **Autenticação**: Não requerida (acesso interno)
- **Rate Limiting**: Não implementado (planejado)

## Endpoints da API

### 1. Health Check

**GET** `/api/health`

Verifica o status do servidor e estatísticas do cache.

#### Parâmetros
Nenhum

#### Resposta
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "cache": {
    "tokenCache": {
      "keys": 1,
      "hits": 15,
      "misses": 2,
      "hitRate": 0.88
    },
    "dataCache": {
      "keys": 5,
      "hits": 45,
      "misses": 8,
      "hitRate": 0.85
    }
  }
}
```

#### Códigos de Status
- `200`: Servidor funcionando corretamente
- `500`: Erro interno do servidor

#### Exemplo de Uso
```bash
curl http://localhost:13456/api/health
```

---

### 2. Dados DRE Paginados

**GET** `/api/dre`

Retorna dados detalhados da DRE com suporte a paginação e filtros.

#### Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Descrição | Exemplo |
|-----------|------|-------------|-----------|---------|
| `dataInicio` | string | Sim | Data inicial no formato YYYY-MM-DD | `2024-01-01` |
| `dataFim` | string | Sim | Data final no formato YYYY-MM-DD | `2024-12-31` |
| `departamento` | string | Não | Filtro por departamento | `COMERCIAL` |
| `linhaDRE` | string | Não | Filtro por linha DRE | `RECEITA OPERACIONAL LIQUIDA` |
| `page` | integer | Não | Número da página (padrão: 1) | `2` |
| `limit` | integer | Não | Registros por página (padrão: 50, máx: 1000) | `100` |

#### Filtros Disponíveis

**Departamentos:**
- `ADM.FINANCEIRO`
- `COMERCIAL`
- `DIRECAO`
- `GENTE E GESTAO`
- `ENGENHARIA`
- `PRODUCAO`
- `SUPPLY CHAIN`
- `POS VENDA`
- `NAO CLASSIFICADO`

**Linhas DRE:**
- `RECEITA OPERACIONAL LIQUIDA`
- `CPV/CMV/CSP`
- `DESPESAS OPERACIONAIS`
- `OUTRAS RECEITAS OPERACIONAIS`
- `OUTRAS DESPESAS OPERACIONAIS`
- `RECEITAS FINANCEIRAS`
- `DESPESAS FINANCEIRAS`
- `RESULTADO NAO OPERACIONAL`
- `PROVISAO PARA IR E CSLL`

#### Resposta
```json
{
  "success": true,
  "data": [
    {
      "centro_codigo": 104,
      "centro_descricao": "COMERCIAL",
      "valor": 150000.00,
      "data_movimento": "2024-01-15",
      "linha_dre": "RECEITA OPERACIONAL LIQUIDA",
      "linha_dre_codigo": 311,
      "departamento": "COMERCIAL"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalRecords": 245,
    "hasNext": true,
    "hasPrevious": false
  },
  "filters": {
    "dataInicio": "2024-01-01",
    "dataFim": "2024-01-31",
    "departamento": "COMERCIAL",
    "linhaDRE": null
  },
  "cache": {
    "hit": false,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Códigos de Status
- `200`: Dados retornados com sucesso
- `400`: Parâmetros inválidos
- `500`: Erro interno do servidor

#### Exemplos de Uso

```bash
# Buscar dados básicos
curl "http://localhost:13456/api/dre?dataInicio=2024-01-01&dataFim=2024-12-31"

# Com filtros
curl "http://localhost:13456/api/dre?dataInicio=2024-01-01&dataFim=2024-12-31&departamento=COMERCIAL&linhaDRE=RECEITA%20OPERACIONAL%20LIQUIDA"

# Paginação
curl "http://localhost:13456/api/dre?dataInicio=2024-01-01&dataFim=2024-12-31&page=2&limit=100"
```

---

### 3. Resumo Agregado DRE

**GET** `/api/dre/summary`

Retorna dados agregados por linha DRE, ideais para gráficos e visualizações.

#### Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `dataInicio` | string | Sim | Data inicial (YYYY-MM-DD) |
| `dataFim` | string | Sim | Data final (YYYY-MM-DD) |
| `departamento` | string | Não | Filtro por departamento |

#### Resposta
```json
{
  "success": true,
  "data": [
    {
      "linha_dre": "RECEITA OPERACIONAL LIQUIDA",
      "linha_dre_codigo": 311,
      "total_valor": 2500000.00,
      "quantidade_lancamentos": 45,
      "percentual_total": 65.5,
      "detalhes_por_departamento": [
        {
          "departamento": "COMERCIAL",
          "valor": 1500000.00,
          "percentual_linha": 60.0
        },
        {
          "departamento": "INDUSTRIAL",
          "valor": 1000000.00,
          "percentual_linha": 40.0
        }
      ]
    }
  ],
  "resumo_geral": {
    "total_receitas": 2500000.00,
    "total_despesas": 1800000.00,
    "resultado_liquido": 700000.00,
    "margem_liquida": 28.0
  },
  "cache": {
    "hit": true,
    "timestamp": "2024-01-15T10:25:00.000Z"
  }
}
```

#### Exemplos de Uso

```bash
# Resumo completo período
curl "http://localhost:13456/api/dre/summary?dataInicio=2024-01-01&dataFim=2024-12-31"

# Resumo por departamento
curl "http://localhost:13456/api/dre/summary?dataInicio=2024-01-01&dataFim=2024-12-31&departamento=COMERCIAL"
```

---

### 4. Dados por Departamento

**GET** `/api/dre/departamentos`

Retorna dados agregados organizados por departamento.

#### Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `dataInicio` | string | Sim | Data inicial (YYYY-MM-DD) |
| `dataFim` | string | Sim | Data final (YYYY-MM-DD) |
| `linhaDRE` | string | Não | Filtro por linha DRE |

#### Resposta
```json
{
  "success": true,
  "data": [
    {
      "departamento": "COMERCIAL",
      "resumo": {
        "total_receitas": 1500000.00,
        "total_despesas": 800000.00,
        "resultado": 700000.00,
        "margem": 46.7,
        "total_lancamentos": 125
      },
      "linhas_dre": [
        {
          "linha_dre": "RECEITA OPERACIONAL LIQUIDA",
          "valor": 1500000.00,
          "percentual_departamento": 75.0
        },
        {
          "linha_dre": "DESPESAS OPERACIONAIS",
          "valor": 500000.00,
          "percentual_departamento": 25.0
        }
      ]
    }
  ],
  "comparativo_departamentos": {
    "melhor_desempenho": {
      "departamento": "COMERCIAL",
      "resultado": 700000.00,
      "margem": 46.7
    },
    "maior_volume": {
      "departamento": "INDUSTRIAL",
      "total_movimentado": 2000000.00
    }
  },
  "cache": {
    "hit": false,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 5. Limpar Cache

**POST** `/api/cache/clear`

Limpa todos os caches (tokens e dados) forçando atualização completa.

#### Corpo da Requisição
```json
{}
```

#### Resposta
```json
{
  "success": true,
  "message": "Cache limpo com sucesso",
  "details": {
    "tokenCache": {
      "keys_cleared": 1,
      "size_before": 1024
    },
    "dataCache": {
      "keys_cleared": 5,
      "size_before": 5120
    },
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Exemplo de Uso

```bash
curl -X POST http://localhost:13456/api/cache/clear
```

---

## Tratamento de Erros

### Formato Padrão de Erro

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Parâmetros inválidos",
    "details": {
      "field": "dataInicio",
      "reason": "Formato de data inválido. Use YYYY-MM-DD"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Códigos de Erro

| Código HTTP | Tipo de Erro | Descrição |
|-------------|-------------|-----------|
| 400 | `VALIDATION_ERROR` | Parâmetros de entrada inválidos |
| 404 | `NOT_FOUND` | Recurso não encontrado |
| 429 | `RATE_LIMIT_EXCEEDED` | Limite de requisições excedido |
| 500 | `INTERNAL_ERROR` | Erro interno do servidor |
| 503 | `SERVICE_UNAVAILABLE` | ERP indisponível |
| 504 | `GATEWAY_TIMEOUT` | Timeout na comunicação com ERP |

### Exemplos de Erros

#### Erro de Validação
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Parâmetros obrigatórios ausentes",
    "details": {
      "missing_fields": ["dataInicio", "dataFim"]
    }
  }
}
```

#### Erro de Conexão com ERP
```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Serviço ERP temporariamente indisponível",
    "details": {
      "erp_status": "connection_refused",
      "retry_after": 300
    }
  }
}
```

## Estratégias de Cache

### Cache de Dados

**Configuração:**
- **TTL**: 30 minutos (1800 segundos)
- **Chave**: Combinação dos parâmetros da requisição
- **Storage**: Memória (Node.js)

**Exemplo de Chave:**
```
dre:data:2024-01-01:2024-12-31:COMERCIAL:RECEITA OPERACIONAL LIQUIDA
```

### Cache de Token

**Configuração:**
- **TTL**: 50 minutos (3000 segundos)
- **Chave**: `auth:token`
- **Storage**: Memória (Node.js)

### Headers de Cache

```http
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```

## Rate Limiting (Planejado)

### Configuração Futura

```javascript
// Implementação planejada
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // limite por IP
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Limite de requisições excedido. Tente novamente em 15 minutos.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);
```

## Autenticação Futura

### Planejamento de Autenticação

```javascript
// Estrutura planejada para JWT
const jwt = require('jsonwebtoken');

app.use('/api/', (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Autenticação necessária'
      }
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token inválido ou expirado'
      }
    });
  }
});
```

## Versionamento da API

### Estrutura de Versionamento

```bash
# Versão atual (v1)
/api/v1/dre
/api/v1/dre/summary
/api/v1/cache/clear

# Retrocompatibilidade mantida por 6 meses
```

### Headers de Versão

```http
API-Version: v1
API-Supported-Versions: v1
API-Deprecated-Versions: 
API-Sunset-Date: 2024-12-31
```

## Teste da API

### Ambiente de Teste

```javascript
// Exemplo de testes com Jest
describe('API DRE', () => {
  test('GET /api/health', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  test('GET /api/dre/summary', async () => {
    const response = await request(app)
      .get('/api/dre/summary')
      .query({
        dataInicio: '2024-01-01',
        dataFim: '2024-12-31'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
```

### Scripts de Teste

```bash
# Teste completo de endpoints
./scripts/test-api.sh

# Teste de carga
./scripts/load-test.sh
```

## Monitoramento da API

### Métricas Disponíveis

```javascript
// Métricas coletadas automaticamente
const metrics = {
  requests: {
    total: 1250,
    successful: 1200,
    errors: 50,
    rate_limit: 0
  },
  response_time: {
    average: 150, // ms
    p95: 300,
    p99: 500
  },
  cache: {
    hit_rate: 0.85,
    size: 1024,
    evictions: 5
  },
  erp: {
    requests: 25,
    errors: 2,
    average_response_time: 2500
  }
};
```

### Endpoint de Métricas

```bash
# Obter métricas da API
curl http://localhost:13456/api/metrics
```

## Boas Práticas

### 1. Consumo da API

```javascript
// Cliente recomendado
class DREAPIClient {
  constructor(baseURL = 'http://localhost:13456/api') {
    this.baseURL = baseURL;
    this.axios = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async getDRESummary(filters) {
    try {
      const response = await this.axios.get('/dre/summary', {
        params: filters
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(error.response.data.error.message);
      }
      throw error;
    }
  }
}
```

### 2. Tratamento de Timeout

```javascript
// Implementação de retry com exponential backoff
async function fetchWithRetry(url, options = {}, retries = 3) {
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { ...options, timeout: 30000 });
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
}
```

### 3. Paginação Eficiente

```javascript
// Carregamento progressivo de dados
async function loadAllDREDates(filters) {
  let allData = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const response = await apiClient.get('/dre', {
      params: { ...filters, page, limit: 1000 }
    });
    
    allData = allData.concat(response.data.data);
    hasMore = response.data.pagination.hasNext;
    page++;
  }
  
  return allData;
}
```

## Conclusão

A API do Dashboard DRE foi projetada para ser:

- **Intuitiva**: Endpoints RESTful com nomes descritivos
- **Flexível**: Múltiplos filtros e opções de paginação
- **Performática**: Cache inteligente e respostas otimizadas
- **Robusta**: Tratamento comprehensive de erros
- **Escalável**: Arquitetura preparada para crescimento

A documentação completa e os exemplos facilitam a integração com diferentes clientes e casos de uso.
