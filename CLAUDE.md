# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dashboard DRE (Demonstracao de Resultados do Exercicio) for AGROSS - an interactive financial results dashboard that fetches data from an ERP system via REST API and displays it with charts and tables.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start with nodemon (auto-reload)
npm start            # Production mode
./scripts/start.sh   # Full startup script with checks
```

## API Testing

```bash
curl http://localhost:13456/api/health
curl "http://localhost:13456/api/dre/summary?dataInicio=2024-01-01&dataFim=2024-12-31"
curl -X POST http://localhost:13456/api/cache/clear
```

## Architecture

**Backend** (`server.js`): Single Express.js server handling:
- Authentication with external ERP API (token caching for 50 min)
- SQL query execution via ERP's REST SQL endpoint
- Data caching with node-cache (30 min TTL)
- Static file serving for frontend

**Frontend** (`public/`):
- `index.html` - Bootstrap 5.3 dashboard layout
- `dashboard.js` - Chart.js visualizations and API consumption
- `styles.css` - Custom styling

**Data Flow**:
1. Frontend calls `/api/dre/*` endpoints
2. Server checks cache, or fetches token from ERP auth endpoint
3. Server executes SQL via ERP's REST SQL endpoint
4. Response cached and returned to frontend

## Key API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/dre` | Paginated DRE data with filters |
| `GET /api/dre/summary` | Aggregated data by DRE line |
| `GET /api/dre/departamentos` | Data grouped by department |
| `POST /api/cache/clear` | Clear all caches |
| `GET /api/health` | Server status and cache stats |

## Filter Parameters

All data endpoints accept: `dataInicio`, `dataFim`, `departamento`, `linhaDRE`, `page`, `limit`

## ERP Integration

External API endpoints (configured in `server.js` API_CONFIG):
- Auth: `https://loginerp-678980304312.us-west1.run.app/auth/login`
- SQL: `https://sql-bi-678980304312.us-west1.run.app/rest/node/consultas/sql/comandos/22`

The DRE SQL query in `server.js` uses UNION ALL to combine debit and credit entries from `con_lancon` and related tables.

## Environment Variables

```bash
PORT=13456                   # Server port
NODE_ENV=development         # development or production
CACHE_TTL_TOKEN=3000         # Token cache in seconds
CACHE_TTL_DATA=1800          # Data cache in seconds
```

## DRE Line Categories

The system categorizes accounting entries into 9 DRE lines based on `clacon` codes:
1. RECEITA OPERACIONAL LIQUIDA (311, 312)
2. CPV/CMV/CSP (321)
3. DESPESAS OPERACIONAIS (32201, 32202)
4. OUTRAS RECEITAS OPERACIONAIS (313, 314)
5. OUTRAS DESPESAS OPERACIONAIS (32205)
6. RECEITAS FINANCEIRAS (32301)
7. DESPESAS FINANCEIRAS (32303)
8. RESULTADO NAO OPERACIONAL (324, 3229901)
9. PROVISAO PARA IR E CSLL

## Departments

Mapped from `centro.codigo` to: ADM.FINANCEIRO, COMERCIAL, DIRECAO, GENTE E GESTAO, ENGENHARIA, PRODUCAO, SUPPLY CHAIN, POS VENDA, NAO CLASSIFICADO
