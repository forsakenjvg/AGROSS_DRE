require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const XLSX = require('xlsx');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 13456;
console.log('🔧 [Server] PORT do .env:', process.env.PORT);
console.log('🔧 [Server] PORT final:', PORT);

// Rate limiting configurations
const rateLimit = require('express-rate-limit');
const { body, query, validationResult } = require('express-validator');

// Security middleware
if (process.env.NODE_ENV !== 'development') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));
}

// Compression
app.use(compression());

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:13456',
      'http://127.0.0.1:13456',
      'https://dashboard.agross.com.br' // Produção
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting for different endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health' || req.path === '/';
  }
});

const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 searches per minute
  message: {
    error: 'Too many search requests',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const exportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // limit each IP to 10 exports per 10 minutes
  message: {
    error: 'Too many export requests',
    retryAfter: '10 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting
app.use('/api/', generalLimiter);
app.use('/api/dre/search', searchLimiter);
app.use('/api/dre/suggestions', searchLimiter);
app.use('/api/export/', exportLimiter);

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files with security headers
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1y' : '0',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Cache configuration
const tokenCache = new NodeCache({ stdTTL: 3000 }); // 50 minutos para token
const dataCache = new NodeCache({ stdTTL: 1800 }); // 30 minutos para dados

// Cache inteligente com diferentes níveis de TTL
const smartCache = {
  summary: { cache: new NodeCache({ stdTTL: 900 }), priority: 1 }, // 15 min - summary
  detail: { cache: new NodeCache({ stdTTL: 1800 }), priority: 2 }, // 30 min - detalhes
  export: { cache: new NodeCache({ stdTTL: 3600 }), priority: 3 }, // 1h - exportações
  analytics: { cache: new NodeCache({ stdTTL: 7200 }), priority: 4 } // 2h - análises complexas
};

// Contadores de acesso para cache LRU
const cacheAccessCount = {};
const cacheLastAccess = {};

// Função para obter cache com prioridade
function getSmartCache(type, key) {
  const cacheObj = smartCache[type];
  if (!cacheObj) return null;
  
  // Atualizar contadores de acesso
  cacheAccessCount[key] = (cacheAccessCount[key] || 0) + 1;
  cacheLastAccess[key] = Date.now();
  
  return cacheObj.cache.get(key);
}

// Função para definir cache com prioridade
function setSmartCache(type, key, value, customTTL) {
  const cacheObj = smartCache[type];
  if (!cacheObj) return false;
  
  const ttl = customTTL || null;
  const success = cacheObj.cache.set(key, value, ttl);
  
  // Atualizar contadores de acesso
  cacheAccessCount[key] = 1;
  cacheLastAccess[key] = Date.now();
  
  // Verificar necessidade de limpar cache
  verificarLimpezaCache();
  
  return success;
}

// Função para limpeza inteligente de cache
function verificarLimpezaCache() {
  const maxCacheSize = 1000; // Limite máximo de itens por cache
  
  Object.entries(smartCache).forEach(([type, { cache }]) => {
    const keys = cache.keys();
    
    if (keys.length > maxCacheSize) {
      console.log(`🧹 [SmartCache] Limpando cache ${type} - ${keys.length} itens`);
      
      // Ordenar por acesso (LRU com frequência)
      const sortedKeys = keys.sort((a, b) => {
        const aAccess = cacheAccessCount[a] || 0;
        const aTime = cacheLastAccess[a] || 0;
        const bAccess = cacheAccessCount[b] || 0;
        const bTime = cacheLastAccess[b] || 0;
        
        // Primeiro pela frequência, depois pelo tempo mais antigo
        if (aAccess !== bAccess) return aAccess - bAccess;
        return aTime - bTime;
      });
      
      // Remover 20% menos acessados
      const toRemove = Math.floor(sortedKeys.length * 0.2);
      for (let i = 0; i < toRemove; i++) {
        cache.del(sortedKeys[i]);
        delete cacheAccessCount[sortedKeys[i]];
        delete cacheLastAccess[sortedKeys[i]];
      }
      
      console.log(`🧹 [SmartCache] Removidos ${toRemove} itens do cache ${type}`);
    }
  });
}

// Função para invalidar cache relacionado
function invalidateRelatedCache(operation, params) {
  console.log(`🔄 [SmartCache] Invalidando cache relacionado - Operação: ${operation}`);
  
  switch (operation) {
    case 'new_data':
      // Invalidar todos os caches quando novos dados são inseridos
      Object.values(smartCache).forEach(({ cache }) => {
        cache.flushAll();
      });
      dataCache.flushAll();
      break;
      
    case 'date_range_change':
      // Invalidar caches de período específico
      const { dataInicio, dataFim } = params;
      Object.values(smartCache).forEach(({ cache }) => {
        const keys = cache.keys();
        keys.forEach(key => {
          if (key.includes(dataInicio) || key.includes(dataFim)) {
            cache.del(key);
          }
        });
      });
      break;
      
    case 'department_filter':
      // Invalidar caches que usam filtros de departamento
      const { departamento } = params;
      Object.values(smartCache).forEach(({ cache }) => {
        const keys = cache.keys();
        keys.forEach(key => {
          if (key.includes(`departamento=${departamento}`)) {
            cache.del(key);
          }
        });
      });
      break;
  }
}

// Função para pré-carregar dados populares
async function preloadPopularData() {
  console.log('🚀 [SmartCache] Iniciando pré-carregamento de dados populares...');
  
  try {
    // Dados do último mês completo
    const today = new Date();
    const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    
    const dataInicio = firstDayLastMonth.toISOString().split('T')[0];
    const dataFim = lastDayLastMonth.toISOString().split('T')[0];
    
    // Pré-carregar sumário do último mês
    const summaryKey = `summary_${JSON.stringify({ dataInicio, dataFim })}`;
    if (!getSmartCache('summary', summaryKey)) {
      console.log('🔄 [SmartCache] Pré-carregando sumário do último mês...');
      const sqlQuery = `
        SELECT
          linha_dre,
          SUM(vl_rateado) as valor_total,
          COUNT(*) as quantidade_lancamentos,
          departamento
        FROM (${DRE_SQL_BASE}) preload_data
        WHERE data >= '${dataInicio}' AND data <= '${dataFim}'
        GROUP BY linha_dre, departamento
        ORDER BY linha_dre
      `;
      
      const result = await executeSQL(sqlQuery);
      
      // Processar dados
      const dreLines = [
        '1) ( = ) RECEITA OPERACIONAL LIQUIDA',
        '2) ( - ) CPV/CMV/CSP',
        '3) ( - ) DESPESAS OPERACIONAIS',
        '4) ( + ) OUTRAS RECEITAS OPERACIONAIS',
        '5) ( - ) OUTRAS DESPESAS OPERACIONAIS',
        '6) ( + ) RECEITAS FINANCEIRAS',
        '7) ( - ) DESPESAS FINANCEIRAS',
        '8) ( +/- ) RESULTADO NAO OPERACIONAL',
        '9) ( - ) PROVISAO PARA IR E CSLL'
      ];
      
      const summary = dreLines.map(line => {
        const lineData = (result || []).filter(r => r.linha_dre === line);
        let valorTotal = lineData.reduce((sum, item) => sum + parseFloat(item.valor_total || 0), 0);
        
        // Para CPV e Despesas, garantir que o valor seja negativo
        if ((line.includes('CPV') || (line.includes('DESPESAS') && !line.includes('PROVISAO'))) && !line.includes('RECEITAS')) {
          valorTotal = -Math.abs(valorTotal);
        }
        
        return {
          linha_dre: line,
          valor_total: valorTotal,
          quantidade_lancamentos: lineData.reduce((sum, item) => sum + parseInt(item.quantidade_lancamentos || 0), 0),
          detalhes_por_departamento: lineData
        };
      });
      
      setSmartCache('summary', summaryKey, summary);
      console.log('✅ [SmartCache] Sumário pré-carregado com sucesso');
    }
    
    // Pré-carregar dados mensais para gráficos
    const monthlyKey = `mensal_${JSON.stringify({ dataInicio, dataFim })}`;
    if (!getSmartCache('analytics', monthlyKey)) {
      console.log('🔄 [SmartCache] Pré-carregando dados mensais...');
      // ... código similar para dados mensais
    }
    
  } catch (error) {
    console.error('❌ [SmartCache] Erro no pré-carregamento:', error);
  }
}

// Endpoint para gerenciar cache
app.post('/api/cache/manage', (req, res) => {
  try {
    const { operation, type, key, customTTL } = req.body;
    
    console.log('⚙️ [API-Cache-Manage] Operação:', operation, { type, key, customTTL });
    
    switch (operation) {
      case 'get':
        const value = type ? getSmartCache(type, key) : dataCache.get(key) || tokenCache.get(key);
        return res.json({ found: !!value, value });
        
      case 'set':
        const success = type 
          ? setSmartCache(type, key, req.body.value, customTTL)
          : dataCache.set(key, req.body.value, customTTL);
        return res.json({ success });
        
      case 'delete':
        const deleted = type 
          ? smartCache[type]?.cache.del(key)
          : dataCache.del(key) || tokenCache.del(key);
        return res.json({ deleted: !!deleted });
        
      case 'invalidate':
        invalidateRelatedCache(type, req.body.params || {});
        return res.json({ message: 'Cache invalidado com sucesso' });
        
      case 'stats':
        const stats = {
          data: dataCache.getStats(),
          token: tokenCache.getStats()
        };
        
        Object.entries(smartCache).forEach(([name, { cache }]) => {
          stats[name] = cache.getStats();
        });
        
        return res.json(stats);
        
      case 'clear_all':
        dataCache.flushAll();
        tokenCache.flushAll();
        Object.values(smartCache).forEach(({ cache }) => cache.flushAll());
        return res.json({ message: 'Todos os caches limpos' });
        
      default:
        return res.status(400).json({ error: 'Operação não suportada' });
    }
  } catch (error) {
    console.error('Erro ao gerenciar cache:', error);
    res.status(500).json({ error: 'Erro ao gerenciar cache', details: error.message });
  }
});

// Agendar limpeza automática de cache
setInterval(() => {
  verificarLimpezaCache();
}, 10 * 60 * 1000); // A cada 10 minutos

// Iniciar pré-carregamento após startup
setTimeout(() => {
  preloadPopularData();
}, 5000); // 5 segundos após inicialização

// Configuracoes da API
const API_CONFIG = {
  auth: {
    url: 'https://loginerp-678980304312.us-west1.run.app/auth/login',
    credentials: {
      username: 'AGROSS_API',
      password: 'vosa9qta',
      grant_type: 'password',
      client_id: 'null',
      client_secret: 'null'
    }
  },
  sql: {
    url: 'https://sql-bi-678980304312.us-west1.run.app/rest/node/consultas/sql/comandos/22'
  }
};

// Mapeamento de departamentos por codigo de centro (reutilizavel)
const DEPARTAMENTO_CASE = `
    case centro.codigo
        when 231 then 'ADM.FINANCEIRO'
        when 82 then 'ADM.FINANCEIRO'
        when 43 then 'ADM.FINANCEIRO'
        when 22 then 'ADM.FINANCEIRO'
        when 104 then 'COMERCIAL'
        when 249 then 'COMERCIAL'
        when 30 then 'COMERCIAL'
        when 206 then 'COMERCIAL'
        when 113 then 'COMERCIAL'
        when 124 then 'COMERCIAL'
        when 204 then 'COMERCIAL'
        when 271 then 'COMERCIAL'
        when 273 then 'COMERCIAL'
        when 54 then 'COMERCIAL'
        when 205 then 'COMERCIAL'
        when 137 then 'COMERCIAL'
        when 136 then 'COMERCIAL'
        when 261 then 'COMERCIAL'
        when 267 then 'COMERCIAL'
        when 270 then 'COMERCIAL'
        when 165 then 'DIRECAO'
        when 5 then 'DIRECAO'
        when 211 then 'DIRECAO'
        when 81 then 'DIRECAO'
        when 274 then 'GENTE E GESTAO'
        when 232 then 'GENTE E GESTAO'
        when 233 then 'GENTE E GESTAO'
        when 84 then 'GENTE E GESTAO'
        when 83 then 'GENTE E GESTAO'
        when 23 then 'ENGENHARIA'
        when 95 then 'ENGENHARIA'
        when 209 then 'PRODUCAO'
        when 9 then 'PRODUCAO'
        when 108 then 'PRODUCAO'
        when 65 then 'PRODUCAO'
        when 72 then 'PRODUCAO'
        when 87 then 'PRODUCAO'
        when 160 then 'PRODUCAO'
        when 32 then 'PRODUCAO'
        when 207 then 'PRODUCAO'
        when 8 then 'PRODUCAO'
        when 88 then 'PRODUCAO'
        when 234 then 'PRODUCAO'
        when 210 then 'PRODUCAO'
        when 237 then 'PRODUCAO'
        when 17 then 'PRODUCAO'
        when 144 then 'PRODUCAO'
        when 33 then 'PRODUCAO'
        when 90 then 'PRODUCAO'
        when 14 then 'PRODUCAO'
        when 10 then 'PRODUCAO'
        when 91 then 'PRODUCAO'
        when 34 then 'PRODUCAO'
        when 7 then 'PRODUCAO'
        when 92 then 'PRODUCAO'
        when 21 then 'PRODUCAO'
        when 93 then 'PRODUCAO'
        when 208 then 'SUPPLY CHAIN'
        when 37 then 'POS VENDA'
        when 85 then 'POS VENDA'
        when 80 then 'SUPPLY CHAIN'
        when 19 then 'SUPPLY CHAIN'
        when 44 then 'SUPPLY CHAIN'
        when 223 then 'SUPPLY CHAIN'
        when 224 then 'SUPPLY CHAIN'
        when 86 then 'SUPPLY CHAIN'
        when 25 then 'SUPPLY CHAIN'
        when 15 then 'SUPPLY CHAIN'
        when 97 then 'SUPPLY CHAIN'
        when 226 then 'POS VENDA'
        else 'NAO CLASSIFICADO'
    end as departamento`;

const ORIGEM_LANC_CASE = `
    case lanc.orilan
        when 'ADI' then 'Adiantamento'
        when 'ANT' then 'Antecipacao'
        when 'APA' then 'Apropriacao de Antecipacao'
        when 'APC' then 'Apropriacao de Parcelas de Contrato'
        when 'BAD' then 'Baixa de Duplicatas'
        when 'BAN' then 'Banco'
        when 'BPC' then 'Baixa de Parcela de Contrato'
        when 'CAG' then 'Custo Agregado'
        when 'CTA' then 'Contratos'
        when 'DUP' then 'Duplicata'
        when 'ENT' then 'Entrada de Mercadoria'
        when 'FAT' then 'Faturamento'
        when 'IMP' then 'Importacao (de lancamentos contabeis)'
        when 'MAN' then 'Manual'
        when 'MAP' then 'Mapa de Custo'
        when 'PAB' then 'Patrimonial'
        when 'PAD' then 'Depreciacao'
        when 'TPC' then 'Apropriacoes de Contratos'
        when 'VDV' then 'Transf. Participante - Despesas de Viagens'
    end as origem_lanc`;

// Consulta SQL completa para DRE (baseada em docs/consulta.sql)
// Query base SEM LIMIT - os filtros e paginacao sao aplicados dinamicamente
const DRE_SQL_BASE = `
SELECT * FROM (
    -- 1) LANCAMENTOS DE DEBITO (g1.clacon = '3')
    SELECT
        'AGROSS' as empresa,
        CASE WHEN lanc.codigo IS NULL THEN '' ELSE 'DEBITO' END as tipo,
        lanc.codigo as codigo_lanc,
        -1*rateio.valrat as vl_rateado,
        CASE WHEN g3.clacon IN ('311','312') THEN -1*rateio.valrat END as rol,
        lanc.datlan as data,
        CASE
            WHEN g3.clacon IN ('311','312') THEN '1) ( = ) RECEITA OPERACIONAL LIQUIDA'
            WHEN g3.clacon IN ('321') THEN '2) ( - ) CPV/CMV/CSP'
            WHEN g4.clacon IN ('32201','32202') THEN '3) ( - ) DESPESAS OPERACIONAIS'
            WHEN g3.clacon IN ('313','314') THEN '4) ( + ) OUTRAS RECEITAS OPERACIONAIS'
            WHEN g4.clacon IN ('32205') THEN '5) ( - ) OUTRAS DESPESAS OPERACIONAIS'
            WHEN g4.clacon IN ('32301') THEN '6) ( + ) RECEITAS FINANCEIRAS'
            WHEN g4.clacon IN ('32303') THEN '7) ( - ) DESPESAS FINANCEIRAS'
            WHEN g3.clacon IN ('324') OR g5.clacon IN ('3229901') THEN '8) ( +/- ) RESULTADO NAO OPERACIONAL'
        END as linha_dre,
        CONCAT(g1.clacon,' - ',g1.descri) g1,
        CONCAT(g2.clacon,' - ',g2.descri) g2,
        CONCAT(g3.clacon,' - ',g3.descri) g3,
        CONCAT(g4.clacon,' - ',g4.descri) g4,
        CONCAT(g5.clacon,' - ',g5.descri) g5,
        CASE WHEN g6.clacon IS NULL THEN '' ELSE CONCAT(g6.clacon,' - ',g6.descri) END as g6,
        hierarquia.clacon,
        hierarquia.descri as conta_contabil,
        CASE hierarquia.sinana WHEN 'S' THEN 'SINTETICA' WHEN 'A' THEN 'ANALITICA' END as tipo_conta,
        centro.codigo as cod_centro,
        centro.descri as centro_resultado,
        ${DEPARTAMENTO_CASE},
        departamento.descri as departamento_sistema,
        lanc.hislan as historico_contabil,
        ${ORIGEM_LANC_CASE}
    FROM
        public.erp_placon hierarquia
        LEFT JOIN con_lancon lanc ON hierarquia.codint = lanc.condeb
        LEFT JOIN public.erp_placon conta ON lanc.condeb = conta.codint
        LEFT JOIN con_ratlan rateio ON lanc.codigo = rateio.codigo
        LEFT JOIN public.erp_centro centro ON rateio.codcen = centro.codigo
        LEFT JOIN public.erp_caddep departamento ON centro.coddep = departamento.codigo
        LEFT JOIN public.erp_placon g1 ON g1.clacon = SUBSTRING(hierarquia.clacon,1,1)
        LEFT JOIN public.erp_placon g2 ON g2.clacon = SUBSTRING(hierarquia.clacon,1,2)
        LEFT JOIN public.erp_placon g3 ON g3.clacon = SUBSTRING(hierarquia.clacon,1,3)
        LEFT JOIN public.erp_placon g4 ON g4.clacon = SUBSTRING(hierarquia.clacon,1,5)
        LEFT JOIN public.erp_placon g5 ON g5.clacon = SUBSTRING(hierarquia.clacon,1,7)
        LEFT JOIN public.erp_placon g6 ON g6.clacon = SUBSTRING(hierarquia.clacon,1,9)
    WHERE
        lanc.coduni IN (136,137)
        AND g1.clacon = '3'
        AND NOT (hierarquia.sinana = 'A' AND lanc.codigo IS NULL)
        AND lanc.orilan <> 'Z'

    UNION ALL

    -- 2) LANCAMENTOS DE CREDITO (g1.clacon = '3')
    SELECT
        'AGROSS' as empresa,
        CASE WHEN lanc.codigo IS NULL THEN '' ELSE 'CREDITO' END as tipo,
        lanc.codigo as codigo_lanc,
        rateio.valrat as vl_rateado,
        CASE WHEN g3.clacon IN ('311','312') THEN rateio.valrat END as rol,
        lanc.datlan as data,
        CASE
            WHEN g3.clacon IN ('311','312') THEN '1) ( = ) RECEITA OPERACIONAL LIQUIDA'
            WHEN g3.clacon IN ('321') THEN '2) ( - ) CPV/CMV/CSP'
            WHEN g4.clacon IN ('32201','32202') THEN '3) ( - ) DESPESAS OPERACIONAIS'
            WHEN g3.clacon IN ('313','314') THEN '4) ( + ) OUTRAS RECEITAS OPERACIONAIS'
            WHEN g4.clacon IN ('32205') THEN '5) ( - ) OUTRAS DESPESAS OPERACIONAIS'
            WHEN g4.clacon IN ('32301') THEN '6) ( + ) RECEITAS FINANCEIRAS'
            WHEN g4.clacon IN ('32303') THEN '7) ( - ) DESPESAS FINANCEIRAS'
            WHEN g3.clacon IN ('324') OR g5.clacon IN ('3229901') THEN '8) ( +/- ) RESULTADO NAO OPERACIONAL'
        END as linha_dre,
        CONCAT(g1.clacon,' - ',g1.descri) g1,
        CONCAT(g2.clacon,' - ',g2.descri) g2,
        CONCAT(g3.clacon,' - ',g3.descri) g3,
        CONCAT(g4.clacon,' - ',g4.descri) g4,
        CONCAT(g5.clacon,' - ',g5.descri) g5,
        CASE WHEN g6.clacon IS NULL THEN '' ELSE CONCAT(g6.clacon,' - ',g6.descri) END as g6,
        hierarquia.clacon,
        hierarquia.descri as conta_contabil,
        CASE hierarquia.sinana WHEN 'S' THEN 'SINTETICA' WHEN 'A' THEN 'ANALITICA' END as tipo_conta,
        centro.codigo as cod_centro,
        centro.descri as centro_resultado,
        ${DEPARTAMENTO_CASE},
        departamento.descri as departamento_sistema,
        lanc.hislan as historico_contabil,
        ${ORIGEM_LANC_CASE}
    FROM
        public.erp_placon hierarquia
        LEFT JOIN con_lancon lanc ON hierarquia.codint = lanc.concre
        LEFT JOIN public.erp_placon conta ON lanc.concre = conta.codint
        LEFT JOIN con_ratlan rateio ON lanc.codigo = rateio.codigo
        LEFT JOIN public.erp_centro centro ON rateio.codcen = centro.codigo
        LEFT JOIN public.erp_caddep departamento ON centro.coddep = departamento.codigo
        LEFT JOIN public.erp_placon g1 ON g1.clacon = SUBSTRING(hierarquia.clacon,1,1)
        LEFT JOIN public.erp_placon g2 ON g2.clacon = SUBSTRING(hierarquia.clacon,1,2)
        LEFT JOIN public.erp_placon g3 ON g3.clacon = SUBSTRING(hierarquia.clacon,1,3)
        LEFT JOIN public.erp_placon g4 ON g4.clacon = SUBSTRING(hierarquia.clacon,1,5)
        LEFT JOIN public.erp_placon g5 ON g5.clacon = SUBSTRING(hierarquia.clacon,1,7)
        LEFT JOIN public.erp_placon g6 ON g6.clacon = SUBSTRING(hierarquia.clacon,1,9)
    WHERE
        lanc.coduni IN (136,137)
        AND g1.clacon = '3'
        AND NOT (hierarquia.sinana = 'A' AND lanc.codigo IS NULL)
        AND lanc.orilan <> 'Z'

    UNION ALL

    -- 3) PROVISOES IR/CSLL - DEBITO (g5.clacon = '4110101')
    SELECT
        'AGROSS' as empresa,
        CASE WHEN lanc.codigo IS NULL THEN '' ELSE 'DEBITO' END as tipo,
        lanc.codigo as codigo_lanc,
        -1*rateio.valrat as vl_rateado,
        NULL as rol,
        lanc.datlan as data,
        '9) ( - ) PROVISAO PARA IR E CSLL' as linha_dre,
        CONCAT(g1.clacon,' - ',g1.descri) g1,
        CONCAT(g2.clacon,' - ',g2.descri) g2,
        CONCAT(g3.clacon,' - ',g3.descri) g3,
        CONCAT(g4.clacon,' - ',g4.descri) g4,
        CONCAT(g5.clacon,' - ',g5.descri) g5,
        CASE WHEN g6.clacon IS NULL THEN '' ELSE CONCAT(g6.clacon,' - ',g6.descri) END as g6,
        hierarquia.clacon,
        hierarquia.descri as conta_contabil,
        CASE hierarquia.sinana WHEN 'S' THEN 'SINTETICA' WHEN 'A' THEN 'ANALITICA' END as tipo_conta,
        centro.codigo as cod_centro,
        centro.descri as centro_resultado,
        ${DEPARTAMENTO_CASE},
        departamento.descri as departamento_sistema,
        lanc.hislan as historico_contabil,
        ${ORIGEM_LANC_CASE}
    FROM
        public.erp_placon hierarquia
        LEFT JOIN con_lancon lanc ON hierarquia.codint = lanc.condeb
        LEFT JOIN public.erp_placon conta ON lanc.condeb = conta.codint
        LEFT JOIN con_ratlan rateio ON lanc.codigo = rateio.codigo
        LEFT JOIN public.erp_centro centro ON rateio.codcen = centro.codigo
        LEFT JOIN public.erp_caddep departamento ON centro.coddep = departamento.codigo
        LEFT JOIN public.erp_placon g1 ON g1.clacon = SUBSTRING(hierarquia.clacon,1,1)
        LEFT JOIN public.erp_placon g2 ON g2.clacon = SUBSTRING(hierarquia.clacon,1,2)
        LEFT JOIN public.erp_placon g3 ON g3.clacon = SUBSTRING(hierarquia.clacon,1,3)
        LEFT JOIN public.erp_placon g4 ON g4.clacon = SUBSTRING(hierarquia.clacon,1,5)
        LEFT JOIN public.erp_placon g5 ON g5.clacon = SUBSTRING(hierarquia.clacon,1,7)
        LEFT JOIN public.erp_placon g6 ON g6.clacon = SUBSTRING(hierarquia.clacon,1,9)
    WHERE
        lanc.coduni IN (136,137)
        AND g5.clacon = '4110101'
        AND NOT (hierarquia.sinana = 'A' AND lanc.codigo IS NULL)
        AND lanc.orilan <> 'Z'

    UNION ALL

    -- 4) PROVISOES IR/CSLL - CREDITO (g5.clacon = '4110101')
    SELECT
        'AGROSS' as empresa,
        CASE WHEN lanc.codigo IS NULL THEN '' ELSE 'CREDITO' END as tipo,
        lanc.codigo as codigo_lanc,
        rateio.valrat as vl_rateado,
        NULL as rol,
        lanc.datlan as data,
        '9) ( - ) PROVISAO PARA IR E CSLL' as linha_dre,
        CONCAT(g1.clacon,' - ',g1.descri) g1,
        CONCAT(g2.clacon,' - ',g2.descri) g2,
        CONCAT(g3.clacon,' - ',g3.descri) g3,
        CONCAT(g4.clacon,' - ',g4.descri) g4,
        CONCAT(g5.clacon,' - ',g5.descri) g5,
        CASE WHEN g6.clacon IS NULL THEN '' ELSE CONCAT(g6.clacon,' - ',g6.descri) END as g6,
        hierarquia.clacon,
        hierarquia.descri as conta_contabil,
        CASE hierarquia.sinana WHEN 'S' THEN 'SINTETICA' WHEN 'A' THEN 'ANALITICA' END as tipo_conta,
        centro.codigo as cod_centro,
        centro.descri as centro_resultado,
        ${DEPARTAMENTO_CASE},
        departamento.descri as departamento_sistema,
        lanc.hislan as historico_contabil,
        ${ORIGEM_LANC_CASE}
    FROM
        public.erp_placon hierarquia
        LEFT JOIN con_lancon lanc ON hierarquia.codint = lanc.concre
        LEFT JOIN public.erp_placon conta ON lanc.concre = conta.codint
        LEFT JOIN con_ratlan rateio ON lanc.codigo = rateio.codigo
        LEFT JOIN public.erp_centro centro ON rateio.codcen = centro.codigo
        LEFT JOIN public.erp_caddep departamento ON centro.coddep = departamento.codigo
        LEFT JOIN public.erp_placon g1 ON g1.clacon = SUBSTRING(hierarquia.clacon,1,1)
        LEFT JOIN public.erp_placon g2 ON g2.clacon = SUBSTRING(hierarquia.clacon,1,2)
        LEFT JOIN public.erp_placon g3 ON g3.clacon = SUBSTRING(hierarquia.clacon,1,3)
        LEFT JOIN public.erp_placon g4 ON g4.clacon = SUBSTRING(hierarquia.clacon,1,5)
        LEFT JOIN public.erp_placon g5 ON g5.clacon = SUBSTRING(hierarquia.clacon,1,7)
        LEFT JOIN public.erp_placon g6 ON g6.clacon = SUBSTRING(hierarquia.clacon,1,9)
    WHERE
        lanc.coduni IN (136,137)
        AND g5.clacon = '4110101'
        AND NOT (hierarquia.sinana = 'A' AND lanc.codigo IS NULL)
        AND lanc.orilan <> 'Z'
) dados
WHERE vl_rateado IS NOT NULL AND vl_rateado <> 0
`;

// Funcao para obter token de autenticacao
async function getAuthToken() {
  const cachedToken = tokenCache.get('access_token');
  if (cachedToken) {
    console.log('Usando token do cache');
    return cachedToken;
  }

  try {
    console.log('Obtendo novo token...');
    const response = await axios.post(API_CONFIG.auth.url, API_CONFIG.auth.credentials);
    const token = response.data.access_token;
    tokenCache.set('access_token', token);
    console.log('Token obtido com sucesso');
    return token;
  } catch (error) {
    console.error('Erro ao obter token:', error.message);
    throw new Error('Falha na autenticacao');
  }
}

// Funcao para executar consulta SQL com retry
async function executeSQL(query, retryCount = 0) {
  try {
    const token = await getAuthToken();
    console.log('Executando SQL...');
    const response = await axios.post(API_CONFIG.sql.url, {
      comsql: query,
      parsql: [],
      pespar: "S"
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minutos timeout
    });

    console.log(`SQL executado - ${response.data?.length || 0} registros`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 401 && retryCount < 1) {
      console.log('Token expirado, renovando...');
      tokenCache.del('access_token');
      return executeSQL(query, retryCount + 1);
    }
    console.error('Erro na consulta SQL:', error.message);
    throw error;
  }
}

// Funcao auxiliar para construir query com filtros
function buildFilteredQuery(baseQuery, conditions, orderBy, limit, offset) {
  let query = `SELECT * FROM (${baseQuery}) filtered_data`;

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  if (orderBy) {
    query += ` ORDER BY ${orderBy}`;
  }

  if (limit) {
    query += ` LIMIT ${limit}`;
  }

  if (offset) {
    query += ` OFFSET ${offset}`;
  }

  return query;
}

// API Routes

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Validation middleware
const validateQuery = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    next();
  };
};

// Middleware de cache
function cacheMiddleware(ttl = 300) {
  return (req, res, next) => {
    const cacheKey = `cache_${req.originalUrl || req.url}_${JSON.stringify(req.query)}`;
    const cachedData = dataCache.get(cacheKey);
    
    if (cachedData) {
      console.log(`🎯 [Cache] Hit para: ${cacheKey}`);
      return res.json(cachedData);
    }
    
    // Override res.json para armazenar resposta no cache
    const originalJson = res.json;
    res.json = function(data) {
      dataCache.set(cacheKey, data, ttl);
      console.log(`💾 [Cache] Stored para: ${cacheKey} (TTL: ${ttl}s)`);
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// GET: Search suggestions (API para autocomplete)
app.get('/api/dre/suggestions', 
  cacheMiddleware(60),
  validateQuery([
    query('q')
      .isLength({ min: 2, max: 100 })
      .withMessage('Query must be between 2 and 100 characters')
      .trim()
      .escape(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ]),
  async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;

    const startTime = performance.now();
    console.log(`🔍 [Suggestions] Query: ${query}`);

    // Buscar sugestões em diferentes campos
    const suggestions = new Set();

    // 1. Sugestões de histórico (LIKE search)
    const historyQuery = `
      SELECT DISTINCT historico_contabil
      FROM (${DRE_SQL_BASE}) dre_data 
      WHERE historico_contabil LIKE '%${query}%'
      AND historico_contabil IS NOT NULL
      ORDER BY historico_contabil
      LIMIT ${limit}
    `;
    const historyResult = await executeSQL(historyQuery);
    historyResult.forEach(row => {
      if (row.historico_contabil) {
        const words = row.historico_contabil.split(/\s+/);
        words.forEach(word => {
          if (word.toLowerCase().includes(query.toLowerCase())) {
            suggestions.add(word);
          }
        });
      }
    });

    // 2. Sugestões de valores (se query parecer com número)
    if (query.match(/[0-9]/)) {
      const valueQuery = `
        SELECT DISTINCT vl_rateado
        FROM (${DRE_SQL_BASE}) dre_data 
        WHERE vl_rateado IS NOT NULL
        ORDER BY vl_rateado
        LIMIT 5
      `;
      const valueResult = await executeSQL(valueQuery);
      valueResult.forEach(row => {
        const value = Math.abs(parseFloat(row.vl_rateado) || 0);
        suggestions.push(`>${Math.floor(value)}`);
        suggestions.push(`<${Math.ceil(value)}`);
      });
    }

    // 3. Sugestões de departamentos
    const deptoQuery = `
      SELECT DISTINCT departamento
      FROM (${DRE_SQL_BASE}) dre_data 
      WHERE departamento LIKE '%${query}%'
      ORDER BY departamento
      LIMIT 3
    `;
    const deptoResult = await executeSQL(deptoQuery);
    deptoResult.forEach(row => {
      if (row.departamento) {
        suggestions.add(`departamento:${row.departamento}`);
      }
    });

    // 4. Sugestões de linhas DRE
    const linhaQuery = `
      SELECT DISTINCT linha_dre
      FROM (${DRE_SQL_BASE}) dre_data 
      WHERE linha_dre LIKE '%${query}%'
      ORDER BY linha_dre
      LIMIT 3
    `;
    const linhaResult = await executeSQL(linhaQuery);
    linhaResult.forEach(row => {
      if (row.linha_dre) {
        const simplified = row.linha_dre.split(')')[1]?.trim() || row.linha_dre;
        if (simplified.toLowerCase().includes(query.toLowerCase())) {
          suggestions.push(`linha:${simplified}`);
        }
      }
    });

    // 5. Sugestões de termos populares pré-definidos
    const popularTerms = [
      'salário', 'aluguel', 'imposto', 'comissão', 'fornecedor',
      '>10000', '<-5000', 'adiantamento', 'provisão'
    ];
    
    popularTerms.forEach(term => {
      if (term.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(term);
      }
    });

    // Converter para array e limitar
    const suggestionsArray = Array.from(suggestions)
      .slice(0, parseInt(limit))
      .sort((a, b) => {
        // Priorizar sugestões que começam com a query
        const aStarts = a.toLowerCase().startsWith(query.toLowerCase());
        const bStarts = b.toLowerCase().startsWith(query.toLowerCase());
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.length - b.length; // Sugestões mais curtas primeiro
      });

    const queryTime = performance.now() - startTime;
    console.log(`⚡ [Suggestions] ${suggestionsArray.length} sugestões em ${queryTime.toFixed(2)}ms`);

    res.json(suggestionsArray);

  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET: DRE Search (Endpoint dedicado para busca)
app.get('/api/dre/search', 
  cacheMiddleware(120),
  validateQuery([
    query('search')
      .isLength({ min: 2, max: 200 })
      .withMessage('Search term must be between 2 and 200 characters')
      .trim()
      .escape(),
    query('dataInicio')
      .optional()
      .isISO8601()
      .withMessage('Data início must be a valid date (YYYY-MM-DD)'),
    query('dataFim')
      .optional()
      .isISO8601()
      .withMessage('Data fim must be a valid date (YYYY-MM-DD)'),
    query('departamento')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Departamento must be less than 50 characters')
      .trim()
      .escape(),
    query('linhaDRE')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Linha DRE must be less than 100 characters')
      .trim()
      .escape(),
    query('tipo')
      .optional()
      .isIn(['CREDITO', 'DEBITO'])
      .withMessage('Tipo must be either CREDITO or DEBITO'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Limit must be between 1 and 1000'),
    query('sort')
      .optional()
      .isIn(['data ASC', 'data DESC', 'vl_rateado ASC', 'vl_rateado DESC'])
      .withMessage('Sort must be one of: data ASC, data DESC, vl_rateado ASC, vl_rateado DESC')
  ]),
  async (req, res) => {
  try {
    const { 
      search, 
      dataInicio, 
      dataFim, 
      departamento, 
      linhaDRE, 
      tipo,
      page = 1, 
      limit = 50, 
      sort = 'data DESC'
    } = req.query;
    
    const limitNum = Math.min(parseInt(limit), 1000);
    const offsetNum = (parseInt(page) - 1) * limitNum;
    const startTime = performance.now();
    
    console.log(`🔍 [DRE Search] Request:`, { 
      search, dataInicio, dataFim, departamento, linhaDRE, tipo,
      page, limit: limitNum, sort 
    });

    // Construir query otimizada para busca
    const conditions = [];

    // Parser inteligente para diferentes tipos de busca
    let searchConditions = [];
    
    if (search.includes('>=')) {
      const value = search.split('>=')[1].trim();
      searchConditions.push(`vl_rateado >= ${parseFloat(value) || 0}`);
    } else if (search.includes('<=')) {
      const value = search.split('<=')[1].trim();
      searchConditions.push(`vl_rateado <= ${parseFloat(value) || 0}`);
    } else if (search.includes('>')) {
      const value = search.split('>')[1].trim();
      searchConditions.push(`vl_rateado > ${parseFloat(value) || 0}`);
    } else if (search.includes('<')) {
      const value = search.split('<')[1].trim();
      searchConditions.push(`vl_rateado < ${parseFloat(value) || 0}`);
    } else {
      // Busca simples com LIKE
      searchConditions.push(`
        (
          historico_contabil LIKE '%${search}%' OR
          departamento LIKE '%${search}%' OR
          linha_dre LIKE '%${search}%' OR
          conta_contabil LIKE '%${search}%' OR
          codigo_lanc LIKE '%${search}%'
        )
      `);
    }

    conditions.push(`(${searchConditions.join(' OR ')})`);

    // Adicionar filtros adicionais
    if (dataInicio && dataFim) {
      conditions.push(`data >= '${dataInicio}' AND data <= '${dataFim}'`);
    } else if (dataInicio) {
      conditions.push(`data >= '${dataInicio}'`);
    } else if (dataFim) {
      conditions.push(`data <= '${dataFim}'`);
    }

    if (departamento) {
      conditions.push(`departamento = '${departamento}'`);
    }

    if (linhaDRE) {
      conditions.push(`linha_dre = '${linhaDRE}'`);
    }

    if (tipo) {
      conditions.push(`tipo = '${tipo}'`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Query de dados simples
    let dataQuery = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY data DESC, historico_contabil) as id,
        data,
        linha_dre,
        departamento,
        conta_contabil,
        vl_rateado,
        tipo,
        historico_contabil,
        codigo_lanc,
        origem_lanc,
        '' as created_at,
        '' as updated_at
      FROM (${DRE_SQL_BASE}) dre_data 
      ${whereClause}
    `;

    // Adicionar ordenação
    if (search.includes('>=')) {
      dataQuery += ' ORDER BY vl_rateado ASC, data DESC';
    } else if (search.includes('>')) {
      dataQuery += ' ORDER BY vl_rateado ASC, data DESC';
    } else if (search.includes('<=')) {
      dataQuery += ' ORDER BY vl_rateado DESC, data DESC';
    } else if (search.includes('<')) {
      dataQuery += ' ORDER BY vl_rateado DESC, data DESC';
    } else {
      dataQuery += ' ORDER BY data DESC, historico_contabil';
    }

    const queryStart = performance.now();
    const allResults = await executeSQL(dataQuery);
    
    // Apply pagination manually
    const startIndex = offsetNum;
    const endIndex = startIndex + limitNum;
    const paginatedResults = allResults.slice(startIndex, endIndex);
    
    const queryTime = performance.now() - queryStart;

    // Query de contagem
    const countQuery = `SELECT COUNT(*) as total FROM (${DRE_SQL_BASE}) dre_data ${whereClause}`;
    const countResult = await executeSQL(countQuery);
    const total = countResult && countResult.length > 0 ? parseInt(countResult[0].total) : 0;

    console.log(`🔍 [DRE Search] Query executada: ${queryTime.toFixed(2)}ms - ${paginatedResults.length}/${total} resultados`);

    const response = {
      data: paginatedResults,
      search: {
        term: search,
        type: search.includes('>') || search.includes('<') ? 'numeric' : 'fulltext',
        results_count: paginatedResults.length,
        total_count: total
      },
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasNext: offsetNum + paginatedResults.length < total,
        hasPrev: offsetNum > 0
      },
      performance: {
        queryTime: parseFloat(queryTime.toFixed(2)),
        totalTime: parseFloat((performance.now() - startTime).toFixed(2))
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error in DRE search:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET: DRE data (Optimizado com índices)
app.get('/api/dre', cacheMiddleware(300), async (req, res) => {
  try {
    const { 
      dataInicio, 
      dataFim, 
      departamento, 
      linhaDRE, 
      tipo,
      page = 1, 
      limit = 50, 
      sort = 'data DESC',
      search,
      offset: reqOffset
    } = req.query;
    
    const limitNum = Math.min(parseInt(limit), 1000); // Limitar a 1000
    const offsetNum = reqOffset ? parseInt(reqOffset) : (parseInt(page) - 1) * limitNum;
    const startTime = performance.now();
    
    console.log(`📊 [DRE Data] Request:`, { 
      dataInicio, dataFim, departamento, linhaDRE, tipo, 
      page, limit: limitNum, sort, search, offset: offsetNum 
    });

    // Cache key inteligente
    const cacheKey = `dre_data_${JSON.stringify(req.query)}`;
    const cachedData = getSmartCache('detail', cacheKey);
    if (cachedData && !search) { // Não usar cache para busca
      const queryTime = performance.now() - startTime;
      console.log(`⚡ [DRE Data] Cache hit - ${queryTime.toFixed(2)}ms`);
      return res.json({
        ...cachedData,
        cached: true,
        performance: { queryTime, cache: true }
      });
    }

    // Construir query otimizada
    const conditions = [];

    // Condição de data
    if (dataInicio && dataFim) {
      conditions.push(`data >= '${dataInicio}' AND data <= '${dataFim}'`);
    } else if (dataInicio) {
      conditions.push(`data >= '${dataInicio}'`);
    } else if (dataFim) {
      conditions.push(`data <= '${dataFim}'`);
    }

    // Filtros
    if (departamento) {
      conditions.push(`departamento = '${departamento}'`);
    }

    if (linhaDRE) {
      conditions.push(`linha_dre = '${linhaDRE}'`);
    }

    if (tipo) {
      conditions.push(`tipo = '${tipo}'`);
    }

    // Busca
    if (search) {
      // Parser inteligente para diferentes tipos de busca
      if (search.includes('>=')) {
        const value = search.split('>=')[1].trim();
        conditions.push(`vl_rateado >= ${parseFloat(value) || 0}`);
      } else if (search.includes('<=')) {
        const value = search.split('<=')[1].trim();
        conditions.push(`vl_rateado <= ${parseFloat(value) || 0}`);
      } else if (search.includes('>')) {
        const value = search.split('>')[1].trim();
        conditions.push(`vl_rateado > ${parseFloat(value) || 0}`);
      } else if (search.includes('<')) {
        const value = search.split('<')[1].trim();
        conditions.push(`vl_rateado < ${parseFloat(value) || 0}`);
      } else {
        // Busca em histórico
        conditions.push(`historico_contabil LIKE '%${search}%'`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query de contagem usando a base DRE_SQL_BASE
    let countQuery = `SELECT COUNT(*) as total FROM (${DRE_SQL_BASE}) dre_data ${whereClause}`;
    
    const countResult = await executeSQL(countQuery);
    const total = countResult && countResult.length > 0 ? parseInt(countResult[0].total) : 0;

    // Query de dados otimizada com ordenação inteligente
    let orderClause = 'ORDER BY data DESC, id DESC';
    if (sort) {
      switch (sort) {
        case 'vl_rateado desc':
          orderClause = 'ORDER BY vl_rateado DESC NULLS LAST, data DESC';
          break;
        case 'vl_rateado asc':
          orderClause = 'ORDER BY vl_rateado ASC NULLS LAST, data DESC';
          break;
        case 'data asc':
          orderClause = 'ORDER BY data ASC, id ASC';
          break;
        case 'data desc':
        default:
          orderClause = 'ORDER BY data DESC, id DESC';
          break;
      }
    }

    const dataQuery = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY data DESC, historico_contabil) as id,
        data,
        linha_dre,
        departamento,
        conta_contabil,
        vl_rateado,
        tipo,
        historico_contabil,
        codigo_lanc,
        origem_lanc,
        '' as created_at,
        '' as updated_at
      FROM (${DRE_SQL_BASE}) dre_data 
      ${whereClause}
      ${orderClause}
    `;

    const queryStart = performance.now();
    const allResults = await executeSQL(dataQuery);
    
    // Apply pagination manually since we can't use LIMIT/OFFSET in the API
    const startIndex = offsetNum;
    const endIndex = startIndex + limitNum;
    const paginatedResults = allResults.slice(startIndex, endIndex);
    
    const queryTime = performance.now() - queryStart;

    // Log de performance
    console.log(`📊 [DRE Data] Query executada: ${queryTime.toFixed(2)}ms - ${paginatedResults.length}/${total} registros`);

    const response = {
      data: paginatedResults,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasNext: offsetNum + paginatedResults.length < total,
        hasPrev: offsetNum > 0
      },
      filters: { dataInicio, dataFim, departamento, linhaDRE, tipo, sort, search },
      performance: {
        queryTime: parseFloat(queryTime.toFixed(2)),
        totalTime: parseFloat((performance.now() - startTime).toFixed(2))
      }
    };

    // Cache apenas para queries sem busca
    if (!search) {
      setSmartCache('detail', cacheKey, response, 600); // 10 minutos
    }

    res.json(response);

  } catch (error) {
    console.error('Error fetching DRE data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Endpoint para dados agregados por linha DRE
app.get('/api/dre/summary', async (req, res) => {
  const startTime = Date.now();
  try {
    const { dataInicio, dataFim, departamento } = req.query;
    console.log('📊 [API-Summary] Request - Filtros:', { dataInicio, dataFim, departamento });

    const cacheKey = `summary_${JSON.stringify(req.query)}`;
    const cachedData = dataCache.get(cacheKey);

    if (cachedData) {
      const duration = Date.now() - startTime;
      console.log(`⚡ [API-Summary] Cache hit - ${duration}ms`);
      return res.json(cachedData);
    }

    const conditions = [];
    if (dataInicio) conditions.push(`data >= '${dataInicio}'`);
    if (dataFim) conditions.push(`data <= '${dataFim}'`);
    if (departamento) conditions.push(`departamento = '${departamento}'`);

    let sqlQuery = `
      SELECT
        linha_dre,
        SUM(vl_rateado) as valor_total,
        COUNT(*) as quantidade_lancamentos,
        departamento
      FROM (${DRE_SQL_BASE}) summary_data
    `;

    if (conditions.length > 0) {
      sqlQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    sqlQuery += `
      GROUP BY linha_dre, departamento
      ORDER BY linha_dre
    `;

    console.log('🔍 [API-Summary] Executando consulta SQL...');
    const sqlStartTime = Date.now();
    const result = await executeSQL(sqlQuery);
    const sqlDuration = Date.now() - sqlStartTime;
    console.log(`✅ [API-Summary] SQL executado em ${sqlDuration}ms - ${result?.length || 0} registros`);

    // Linhas do DRE na ordem correta
    const dreLines = [
      '1) ( = ) RECEITA OPERACIONAL LIQUIDA',
      '2) ( - ) CPV/CMV/CSP',
      '3) ( - ) DESPESAS OPERACIONAIS',
      '4) ( + ) OUTRAS RECEITAS OPERACIONAIS',
      '5) ( - ) OUTRAS DESPESAS OPERACIONAIS',
      '6) ( + ) RECEITAS FINANCEIRAS',
      '7) ( - ) DESPESAS FINANCEIRAS',
      '8) ( +/- ) RESULTADO NAO OPERACIONAL',
      '9) ( - ) PROVISAO PARA IR E CSLL'
    ];

    const summary = dreLines.map(line => {
      const lineData = (result || []).filter(r => r.linha_dre === line);
      let valorTotal = lineData.reduce((sum, item) => sum + parseFloat(item.valor_total || 0), 0);
      
      // Para CPV e Despesas, garantir que o valor seja negativo
      // Se a linha contém "CPV" ou "DESPESAS" (exceto "PROVISAO") e não contém "RECEITAS"
      if ((line.includes('CPV') || (line.includes('DESPESAS') && !line.includes('PROVISAO'))) && !line.includes('RECEITAS')) {
        valorTotal = -Math.abs(valorTotal);
      }
      
      return {
        linha_dre: line,
        valor_total: valorTotal,
        quantidade_lancamentos: lineData.reduce((sum, item) => sum + parseInt(item.quantidade_lancamentos || 0), 0),
        detalhes_por_departamento: lineData
      };
    });

    const totalDuration = Date.now() - startTime;
    console.log(`🚀 [API-Summary] Request completa em ${totalDuration}ms`);

    dataCache.set(cacheKey, summary);
    res.json(summary);

  } catch (error) {
    console.error('Erro ao buscar summary DRE:', error);
    res.status(500).json({ error: 'Erro ao buscar dados resumidos', details: error.message });
  }
});

// Endpoint para dados por departamento
app.get('/api/dre/departamentos', async (req, res) => {
  const startTime = Date.now();
  try {
    const { dataInicio, dataFim } = req.query;
    console.log('📊 [API-Departments] Request - Filtros:', { dataInicio, dataFim });

    const cacheKey = `deptos_${JSON.stringify(req.query)}`;
    const cachedData = dataCache.get(cacheKey);

    if (cachedData) {
      const duration = Date.now() - startTime;
      console.log(`⚡ [API-Departments] Cache hit - ${duration}ms`);
      return res.json(cachedData);
    }

    const conditions = [];
    if (dataInicio) conditions.push(`data >= '${dataInicio}'`);
    if (dataFim) conditions.push(`data <= '${dataFim}'`);

    let sqlQuery = `
      SELECT
        departamento,
        SUM(vl_rateado) as valor_total,
        COUNT(*) as quantidade_lancamentos,
        COUNT(DISTINCT linha_dre) as linhas_dre_ativas
      FROM (${DRE_SQL_BASE}) dept_data
    `;

    if (conditions.length > 0) {
      sqlQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    sqlQuery += `
      GROUP BY departamento
      ORDER BY valor_total DESC
    `;

    console.log('🔍 [API-Departments] Executando consulta SQL...');
    const sqlStartTime = Date.now();
    const result = await executeSQL(sqlQuery);
    const sqlDuration = Date.now() - sqlStartTime;
    console.log(`✅ [API-Departments] SQL executado em ${sqlDuration}ms - ${result?.length || 0} registros`);

    const totalDuration = Date.now() - startTime;
    console.log(`🚀 [API-Departments] Request completa em ${totalDuration}ms`);

    dataCache.set(cacheKey, result || []);
    res.json(result || []);

  } catch (error) {
    console.error('Erro ao buscar dados por departamento:', error);
    res.status(500).json({ error: 'Erro ao buscar dados por departamento', details: error.message });
  }
});

// Endpoint para dados mensais otimizado
app.get('/api/dre/mensal', async (req, res) => {
  const startTime = Date.now();
  try {
    const { dataInicio, dataFim, departamento } = req.query;
    console.log('📊 [API-Monthly] Request - Filtros:', { dataInicio, dataFim, departamento });

    const cacheKey = `mensal_${JSON.stringify(req.query)}`;
    const cachedData = dataCache.get(cacheKey);

    if (cachedData) {
      const duration = Date.now() - startTime;
      console.log(`⚡ [API-Monthly] Cache hit - ${duration}ms`);
      return res.json(cachedData);
    }

    const conditions = [];
    if (dataInicio) conditions.push(`data >= '${dataInicio}'`);
    if (dataFim) conditions.push(`data <= '${dataFim}'`);
    if (departamento) conditions.push(`departamento = '${departamento}'`);

    // Query otimizada para dados mensais agregados
    let sqlQuery = `
      SELECT
        TO_CHAR(data::date, 'YYYY-MM') as mes,
        CASE 
          WHEN linha_dre LIKE '%RECEITA OPERACIONAL LIQUIDA%' THEN 'Receita Operacional'
          WHEN linha_dre LIKE '%CPV/CMV/CSP%' THEN 'CPV/CMV/CSP'
          WHEN linha_dre LIKE '%DESPESAS OPERACIONAIS%' AND linha_dre NOT LIKE '%OUTRAS%' THEN 'Despesas Operacionais'
          WHEN linha_dre LIKE '%OUTRAS RECEITAS OPERACIONAIS%' THEN 'Outras Receitas Oper.'
          WHEN linha_dre LIKE '%OUTRAS DESPESAS OPERACIONAIS%' THEN 'Outras Despesas Oper.'
          WHEN linha_dre LIKE '%RECEITAS FINANCEIRAS%' THEN 'Receitas Financeiras'
          WHEN linha_dre LIKE '%DESPESAS FINANCEIRAS%' THEN 'Despesas Financeiras'
          WHEN linha_dre LIKE '%RESULTADO NAO OPERACIONAL%' THEN 'Resultado Não Oper.'
          WHEN linha_dre LIKE '%PROVISAO PARA IR E CSLL%' THEN 'Provisão IR/CSLL'
        END as categoria_dre,
        SUM(vl_rateado) as valor_total
      FROM (${DRE_SQL_BASE}) monthly_data
    `;

    if (conditions.length > 0) {
      sqlQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    sqlQuery += `
      GROUP BY TO_CHAR(data::date, 'YYYY-MM'), categoria_dre
      ORDER BY mes, categoria_dre
    `;

    console.log('🔍 [API-Monthly] Executando consulta SQL mensal...');
    const sqlStartTime = Date.now();
    const result = await executeSQL(sqlQuery);
    const sqlDuration = Date.now() - sqlStartTime;
    console.log(`✅ [API-Monthly] SQL executado em ${sqlDuration}ms - ${result?.length || 0} registros`);

    // Processar dados para estrutura de gráfico
    const monthlyData = {};
    const categorias = new Set();

    (result || []).forEach(row => {
      const mes = row.mes;
      const categoria = row.categoria_dre;
      let valor = parseFloat(row.valor_total || 0);
      
      // Para CPV e Despesas, garantir que o valor seja negativo
      if (categoria === 'CPV/CMV/CSP' || categoria === 'Despesas Operacionais' || categoria === 'Outras Despesas Oper.' || categoria === 'Despesas Financeiras') {
        valor = -Math.abs(valor);
      }

      categorias.add(categoria);

      if (!monthlyData[mes]) {
        monthlyData[mes] = {};
      }
      monthlyData[mes][categoria] = valor;
    });

    // Converter para arrays para o Chart.js
    const meses = Object.keys(monthlyData).sort();
    const datasets = Array.from(categorias).map(categoria => {
      const cores = {
        'Receita Operacional': 'rgba(25, 135, 84, 0.8)',
        'CPV/CMV/CSP': 'rgba(255, 193, 7, 0.8)',
        'Despesas Operacionais': 'rgba(220, 53, 69, 0.8)',
        'Outras Receitas Oper.': 'rgba(13, 202, 240, 0.8)',
        'Outras Despesas Oper.': 'rgba(255, 127, 80, 0.8)',
        'Receitas Financeiras': 'rgba(40, 167, 69, 0.8)',
        'Despesas Financeiras': 'rgba(220, 53, 69, 0.6)',
        'Resultado Não Oper.': 'rgba(108, 117, 125, 0.8)',
        'Provisão IR/CSLL': 'rgba(102, 16, 242, 0.8)'
      };

      return {
        label: categoria,
        data: meses.map(mes => monthlyData[mes][categoria] || 0),
        backgroundColor: cores[categoria] || 'rgba(153, 102, 255, 0.8)',
        borderColor: (cores[categoria] || 'rgba(153, 102, 255, 0.8)').replace('0.8', '1'),
        borderWidth: 1
      };
    });

    const response = {
      labels: meses,
      datasets: datasets
    };

    const totalDuration = Date.now() - startTime;
    console.log(`🚀 [API-Monthly] Request completa em ${totalDuration}ms`);

    dataCache.set(cacheKey, response);
    res.json(response);

  } catch (error) {
    console.error('Erro ao buscar dados mensais:', error);
    res.status(500).json({ error: 'Erro ao buscar dados mensais', details: error.message });
  }
});

// Endpoint para limpar cache
app.post('/api/cache/clear', (req, res) => {
  dataCache.flushAll();
  tokenCache.flushAll();
  console.log('Cache limpo');
  res.json({ message: 'Cache limpo com sucesso' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    port: PORT,
    cache_stats: {
      data: dataCache.getStats(),
      token: tokenCache.getStats()
    }
  });
});

// Endpoint para exportação em CSV
app.get('/api/export/csv', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      dataInicio,
      dataFim,
      departamento,
      linhaDRE,
      type = 'detalhado'
    } = req.query;

    console.log('📊 [API-Export-CSV] Request - Filtros:', { dataInicio, dataFim, departamento, linhaDRE, type });

    const cacheKey = `export_csv_${JSON.stringify(req.query)}`;
    const cachedData = dataCache.get(cacheKey);

    if (cachedData) {
      const duration = Date.now() - startTime;
      console.log(`⚡ [API-Export-CSV] Cache hit - ${duration}ms`);
      return res.setHeader('Content-Type', 'text/csv')
               .setHeader('Content-Disposition', `attachment; filename="dre_export_${new Date().toISOString().split('T')[0]}.csv"`)
               .send(cachedData);
    }

    const conditions = [];
    if (dataInicio) conditions.push(`data >= '${dataInicio}'`);
    if (dataFim) conditions.push(`data <= '${dataFim}'`);
    if (departamento) conditions.push(`departamento = '${departamento}'`);
    if (linhaDRE) conditions.push(`linha_dre = '${linhaDRE}'`);

    let sqlQuery;
    
    if (type === 'resumido') {
      // Exportação resumida - agrupada por linha DRE e departamento
      sqlQuery = `
        SELECT
          linha_dre,
          departamento,
          SUM(vl_rateado) as valor_total,
          COUNT(*) as quantidade_lancamentos
        FROM (${DRE_SQL_BASE}) export_data
        ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
        GROUP BY linha_dre, departamento
        ORDER BY linha_dre, departamento
      `;
    } else {
      // Exportação detalhada - todos os campos
      sqlQuery = buildFilteredQuery(
        DRE_SQL_BASE,
        conditions,
        'data DESC, linha_dre, departamento',
        10000, // Limite para exportação
        0
      );
    }

    console.log('🔍 [API-Export-CSV] Executando consulta SQL...');
    const sqlStartTime = Date.now();
    const result = await executeSQL(sqlQuery);
    const sqlDuration = Date.now() - sqlStartTime;
    console.log(`✅ [API-Export-CSV] SQL executado em ${sqlDuration}ms - ${result?.length || 0} registros`);

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Nenhum dado encontrado para exportação' });
    }

    // Criar CSV
    const headers = Object.keys(result[0]);
    const csvContent = [
      headers.join(','),
      ...result.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escapar aspas e adicionar aspas se contiver vírgula ou aspas
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value !== null && value !== undefined ? value : '';
        }).join(',')
      )
    ].join('\n');

    const totalDuration = Date.now() - startTime;
    console.log(`🚀 [API-Export-CSV] Exportação completa em ${totalDuration}ms`);

    // Cache do CSV
    dataCache.set(cacheKey, csvContent);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="dre_export_${type}_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Erro na exportação CSV:', error);
    res.status(500).json({ error: 'Erro ao exportar dados', details: error.message });
  }
});

// Endpoint para exportação em Excel
app.get('/api/export/excel', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      dataInicio,
      dataFim,
      departamento,
      linhaDRE,
      type = 'detalhado'
    } = req.query;

    console.log('📊 [API-Export-Excel] Request - Filtros:', { dataInicio, dataFim, departamento, linhaDRE, type });

    const cacheKey = `export_excel_${JSON.stringify(req.query)}`;
    const cachedData = dataCache.get(cacheKey);

    if (cachedData) {
      const duration = Date.now() - startTime;
      console.log(`⚡ [API-Export-Excel] Cache hit - ${duration}ms`);
      return res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
               .setHeader('Content-Disposition', `attachment; filename="dre_export_${new Date().toISOString().split('T')[0]}.xlsx"`)
               .send(cachedData);
    }

    const conditions = [];
    if (dataInicio) conditions.push(`data >= '${dataInicio}'`);
    if (dataFim) conditions.push(`data <= '${dataFim}'`);
    if (departamento) conditions.push(`departamento = '${departamento}'`);
    if (linhaDRE) conditions.push(`linha_dre = '${linhaDRE}'`);

    let result;
    
    if (type === 'resumido') {
      // Exportação resumida - agrupada por linha DRE e departamento
      const sqlQuery = `
        SELECT
          linha_dre,
          departamento,
          SUM(vl_rateado) as valor_total,
          COUNT(*) as quantidade_lancamentos
        FROM (${DRE_SQL_BASE}) export_data
        ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
        GROUP BY linha_dre, departamento
        ORDER BY linha_dre, departamento
      `;
      
      console.log('🔍 [API-Export-Excel] Executando consulta SQL resumida...');
      const sqlStartTime = Date.now();
      result = await executeSQL(sqlQuery);
      const sqlDuration = Date.now() - sqlStartTime;
      console.log(`✅ [API-Export-Excel] SQL resumido executado em ${sqlDuration}ms - ${result?.length || 0} registros`);
    } else {
      // Exportação detalhada - todos os campos
      const sqlQuery = buildFilteredQuery(
        DRE_SQL_BASE,
        conditions,
        'data DESC, linha_dre, departamento',
        10000, // Limite para exportação
        0
      );
      
      console.log('🔍 [API-Export-Excel] Executando consulta SQL detalhada...');
      const sqlStartTime = Date.now();
      result = await executeSQL(sqlQuery);
      const sqlDuration = Date.now() - sqlStartTime;
      console.log(`✅ [API-Export-Excel] SQL detalhada executado em ${sqlDuration}ms - ${result?.length || 0} registros`);
    }

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Nenhum dado encontrado para exportação' });
    }

    // Criar workbook e worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(result, {
      header: Object.keys(result[0]),
      skipHeader: false
    });

    // Formatação condicional básica para valores
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = 0; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[cellAddress];
        
        if (cell && C === Object.keys(result[0]).indexOf('vl_rateado') || C === Object.keys(result[0]).indexOf('valor_total')) {
          // Formatar como número
          cell.t = 'n';
          if (cell.v) cell.v = parseFloat(cell.v);
        }
      }
    }

    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(wb, ws, type === 'resumido' ? 'DRE_Resumido' : 'DRE_Detalhado');

    // Gerar buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const totalDuration = Date.now() - startTime;
    console.log(`🚀 [API-Export-Excel] Exportação completa em ${totalDuration}ms`);

    // Cache do buffer
    dataCache.set(cacheKey, excelBuffer);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="dre_export_${type}_${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(excelBuffer);

  } catch (error) {
    console.error('Erro na exportação Excel:', error);
    res.status(500).json({ error: 'Erro ao exportar dados', details: error.message });
  }
});

// Endpoint para comparação de períodos
app.get('/api/dre/comparativo', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      dataInicio,
      dataFim,
      dataInicioAnterior,
      dataFimAnterior,
      departamento,
      linhaDRE
    } = req.query;

    console.log('📊 [API-Comparativo] Request - Filtros:', { 
      dataInicio, dataFim, dataInicioAnterior, dataFimAnterior, departamento, linhaDRE 
    });

    const cacheKey = `comparativo_${JSON.stringify(req.query)}`;
    const cachedData = dataCache.get(cacheKey);

    if (cachedData) {
      const duration = Date.now() - startTime;
      console.log(`⚡ [API-Comparativo] Cache hit - ${duration}ms`);
      return res.json(cachedData);
    }

    // Validar períodos
    if (!dataInicio || !dataFim || !dataInicioAnterior || !dataFimAnterior) {
      return res.status(400).json({ 
        error: 'Parâmetros obrigatórios: dataInicio, dataFim, dataInicioAnterior, dataFimAnterior' 
      });
    }

    const baseConditions = [];
    if (departamento) baseConditions.push(`departamento = '${departamento}'`);
    if (linhaDRE) baseConditions.push(`linha_dre = '${linhaDRE}'`);

    // Query para período atual
    const conditionsAtual = [
      ...baseConditions,
      `data >= '${dataInicio}'`,
      `data <= '${dataFim}'`
    ];

    const sqlQueryAtual = `
      SELECT
        linha_dre,
        SUM(vl_rateado) as valor_atual,
        COUNT(*) as quantidade_atual
      FROM (${DRE_SQL_BASE}) comp_data
      WHERE ${conditionsAtual.join(' AND ')}
      GROUP BY linha_dre
    `;

    console.log('🔍 [API-Comparativo] Executando consulta período atual...');
    const sqlStartTime = Date.now();
    const resultadoAtual = await executeSQL(sqlQueryAtual);
    const sqlDuration = Date.now() - sqlStartTime;
    console.log(`✅ [API-Comparativo] SQL atual executado em ${sqlDuration}ms - ${resultadoAtual?.length || 0} registros`);

    // Query para período anterior
    const conditionsAnterior = [
      ...baseConditions,
      `data >= '${dataInicioAnterior}'`,
      `data <= '${dataFimAnterior}'`
    ];

    const sqlQueryAnterior = `
      SELECT
        linha_dre,
        SUM(vl_rateado) as valor_anterior,
        COUNT(*) as quantidade_anterior
      FROM (${DRE_SQL_BASE}) comp_data
      WHERE ${conditionsAnterior.join(' AND ')}
      GROUP BY linha_dre
    `;

    console.log('🔍 [API-Comparativo] Executando consulta período anterior...');
    const sqlStartTime2 = Date.now();
    const resultadoAnterior = await executeSQL(sqlQueryAnterior);
    const sqlDuration2 = Date.now() - sqlStartTime2;
    console.log(`✅ [API-Comparativo] SQL anterior executado em ${sqlDuration2}ms - ${resultadoAnterior?.length || 0} registros`);

    // Linhas do DRE na ordem correta
    const dreLines = [
      '1) ( = ) RECEITA OPERACIONAL LIQUIDA',
      '2) ( - ) CPV/CMV/CSP',
      '3) ( - ) DESPESAS OPERACIONAIS',
      '4) ( + ) OUTRAS RECEITAS OPERACIONAIS',
      '5) ( - ) OUTRAS DESPESAS OPERACIONAIS',
      '6) ( + ) RECEITAS FINANCEIRAS',
      '7) ( - ) DESPESAS FINANCEIRAS',
      '8) ( +/- ) RESULTADO NAO OPERACIONAL',
      '9) ( - ) PROVISAO PARA IR E CSLL'
    ];

    // Combinar resultados
    const comparativo = dreLines.map(line => {
      const atual = resultadoAtual?.find(r => r.linha_dre === line);
      const anterior = resultadoAnterior?.find(r => r.linha_dre === line);
      
      const valorAtual = parseFloat(atual?.valor_atual || 0);
      const valorAnterior = parseFloat(anterior?.valor_anterior || 0);
      const quantidadeAtual = parseInt(atual?.quantidade_atual || 0);
      const quantidadeAnterior = parseInt(anterior?.quantidade_anterior || 0);
      
      // Para CPV e Despesas, garantir que o valor seja negativo
      const valorAtualAjustado = (line.includes('CPV') || (line.includes('DESPESAS') && !line.includes('PROVISAO'))) && !line.includes('RECEITAS') 
        ? -Math.abs(valorAtual) 
        : valorAtual;
      
      const valorAnteriorAjustado = (line.includes('CPV') || (line.includes('DESPESAS') && !line.includes('PROVISAO'))) && !line.includes('RECEITAS') 
        ? -Math.abs(valorAnterior) 
        : valorAnterior;
      
      const variacaoValor = valorAtualAjustado - valorAnteriorAjustado;
      const variacaoPercentual = valorAnteriorAjustado !== 0 ? (variacaoValor / Math.abs(valorAnteriorAjustado)) * 100 : 0;

      return {
        linha_dre: line,
        periodo_atual: {
          valor: valorAtualAjustado,
          quantidade: quantidadeAtual
        },
        periodo_anterior: {
          valor: valorAnteriorAjustado,
          quantidade: quantidadeAnterior
        },
        variacao: {
          valor_absoluto: variacaoValor,
          valor_percentual: variacaoPercentual
        }
      };
    });

    const totalDuration = Date.now() - startTime;
    console.log(`🚀 [API-Comparativo] Request completa em ${totalDuration}ms`);

    dataCache.set(cacheKey, comparativo);
    res.json(comparativo);

  } catch (error) {
    console.error('Erro ao buscar dados comparativos:', error);
    res.status(500).json({ error: 'Erro ao buscar dados comparativos', details: error.message });
  }
});

// Endpoint para análise de tendências
app.get('/api/dre/tendencias', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      dataInicio,
      dataFim,
      departamento,
      linhaDRE,
      projectionMonths = 3
    } = req.query;

    console.log('📊 [API-Tendencias] Request - Filtros:', { dataInicio, dataFim, departamento, linhaDRE, projectionMonths });

    const cacheKey = `tendencias_${JSON.stringify(req.query)}`;
    const cachedData = dataCache.get(cacheKey);

    if (cachedData) {
      const duration = Date.now() - startTime;
      console.log(`⚡ [API-Tendencias] Cache hit - ${duration}ms`);
      return res.json(cachedData);
    }

    if (!dataInicio || !dataFim) {
      return res.status(400).json({ 
        error: 'Parâmetros obrigatórios: dataInicio, dataFim' 
      });
    }

    const conditions = [];
    if (dataInicio) conditions.push(`data >= '${dataInicio}'`);
    if (dataFim) conditions.push(`data <= '${dataFim}'`);
    if (departamento) conditions.push(`departamento = '${departamento}'`);
    if (linhaDRE) conditions.push(`linha_dre = '${linhaDRE}'`);

    // Query para dados mensais históricos
    const sqlQuery = `
      SELECT
        TO_CHAR(data::date, 'YYYY-MM') as mes,
        CASE 
          WHEN linha_dre LIKE '%RECEITA OPERACIONAL LIQUIDA%' THEN 'Receita Operacional'
          WHEN linha_dre LIKE '%CPV/CMV/CSP%' THEN 'CPV/CMV/CSP'
          WHEN linha_dre LIKE '%DESPESAS OPERACIONAIS%' AND linha_dre NOT LIKE '%OUTRAS%' THEN 'Despesas Operacionais'
          WHEN linha_dre LIKE '%OUTRAS RECEITAS OPERACIONAIS%' THEN 'Outras Receitas Oper.'
          WHEN linha_dre LIKE '%OUTRAS DESPESAS OPERACIONAIS%' THEN 'Outras Despesas Oper.'
          WHEN linha_dre LIKE '%RECEITAS FINANCEIRAS%' THEN 'Receitas Financeiras'
          WHEN linha_dre LIKE '%DESPESAS FINANCEIRAS%' THEN 'Despesas Financeiras'
          WHEN linha_dre LIKE '%RESULTADO NAO OPERACIONAL%' THEN 'Resultado Não Oper.'
          WHEN linha_dre LIKE '%PROVISAO PARA IR E CSLL%' THEN 'Provisão IR/CSLL'
        END as categoria_dre,
        SUM(vl_rateado) as valor_total,
        COUNT(*) as quantidade_lancamentos
      FROM (${DRE_SQL_BASE}) trend_data
      WHERE ${conditions.join(' AND ')}
      GROUP BY TO_CHAR(data::date, 'YYYY-MM'), categoria_dre
      ORDER BY mes, categoria_dre
    `;

    console.log('🔍 [API-Tendencias] Executando consulta SQL...');
    const sqlStartTime = Date.now();
    const result = await executeSQL(sqlQuery);
    const sqlDuration = Date.now() - sqlStartTime;
    console.log(`✅ [API-Tendencias] SQL executado em ${sqlDuration}ms - ${result?.length || 0} registros`);

    if (!result || result.length === 0) {
      return res.json({ 
        dados: [], 
        projecoes: [], 
        analises: [] 
      });
    }

    // Processar dados para estrutura de análise
    const dadosMensais = {};
    const categorias = new Set();

    result.forEach(row => {
      const mes = row.mes;
      const categoria = row.categoria_dre;
      let valor = parseFloat(row.valor_total || 0);
      
      // Para CPV e Despesas, garantir que o valor seja negativo
      if (categoria === 'CPV/CMV/CSP' || categoria === 'Despesas Operacionais' || 
          categoria === 'Outras Despesas Oper.' || categoria === 'Despesas Financeiras') {
        valor = -Math.abs(valor);
      }

      categorias.add(categoria);

      if (!dadosMensais[mes]) {
        dadosMensais[mes] = {};
      }
      dadosMensais[mes][categoria] = valor;
    });

    const meses = Object.keys(dadosMensais).sort();
    
    // Calcular projeções usando regressão linear simples
    const projecoes = {};
    Array.from(categorias).forEach(categoria => {
      const valores = meses.map(mes => dadosMensais[mes][categoria] || 0);
      const x = meses.map((_, index) => index); // 0, 1, 2, ...
      
      const projecao = calcularRegressaoLinear(x, valores, parseInt(projectionMonths));
      if (projecao) {
        projecoes[categoria] = {
          coeficiente_angular: projecao.slope,
          coeficiente_linear: projecao.intercept,
          r_squared: projecao.r2,
          tendencia: projecao.slope > 0 ? 'crescente' : projecao.slope < 0 ? 'decrescente' : 'estavel',
          projecoes: projecao.projections.map((valor, index) => ({
            mes: projetarMes(meses[meses.length - 1], index + 1),
            valor: valor
          }))
        };
      }
    });

    // Análise de sazonalidade
    const analiseSazonalidade = calcularSazonalidade(dadosMensais, categorias);

    // Identificar anomalias
    const anomalias = identificarAnomalias(dadosMensais, categorias);

    const response = {
      dados: {
        meses: meses,
        series: Array.from(categorias).map(categoria => ({
          categoria: categoria,
          dados: meses.map(mes => ({
            mes: mes,
            valor: dadosMensais[mes][categoria] || 0
          }))
        }))
      },
      projecoes: projecoes,
      analises: {
        sazonalidade: analiseSazonalidade,
        anomalias: anomalias,
        resumo: Array.from(categorias).map(categoria => {
          const valores = meses.map(mes => dadosMensais[mes][categoria] || 0);
          const tendencia = projecoes[categoria];
          return {
            categoria: categoria,
            media: valores.reduce((a, b) => a + b, 0) / valores.length,
            max: Math.max(...valores),
            min: Math.min(...valores),
            tendencia: tendencia?.tendencia || 'estavel',
            forca_tendencia: tendencia?.r_squared || 0
          };
        })
      },
      periodo_analise: {
        inicio: dataInicio,
        fim: dataFim,
        meses_projecao: projectionMonths
      }
    };

    const totalDuration = Date.now() - startTime;
    console.log(`🚀 [API-Tendencias] Request completa em ${totalDuration}ms`);

    dataCache.set(cacheKey, response);
    res.json(response);

  } catch (error) {
    console.error('Erro ao buscar análise de tendências:', error);
    res.status(500).json({ error: 'Erro ao buscar análise de tendências', details: error.message });
  }
});

// Funções auxiliares para análise de tendências
function calcularRegressaoLinear(x, y, projectionPeriods) {
  const n = x.length;
  if (n === 0) return null;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calcular R²
  const meanY = sumY / n;
  const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
  const ssResidual = y.reduce((sum, yi, i) => {
    const predicted = slope * x[i] + intercept;
    return sum + Math.pow(yi - predicted, 2);
  }, 0);
  const r2 = 1 - (ssResidual / ssTotal);

  // Projetar valores futuros
  const projections = [];
  for (let i = 1; i <= projectionPeriods; i++) {
    const futureX = x[x.length - 1] + i;
    projections.push(slope * futureX + intercept);
  }

  return { slope, intercept, r2, projections };
}

function projetarMes(ultimoMes, mesesAdiante) {
  const [ano, mes] = ultimoMes.split('-').map(Number);
  let novoMes = mes + mesesAdiante;
  let novoAno = ano;
  
  while (novoMes > 12) {
    novoMes -= 12;
    novoAno++;
  }
  
  return `${novoAno}-${novoMes.toString().padStart(2, '0')}`;
}

function calcularSazonalidade(dadosMensais, categorias) {
  const sazonalidade = {};
  
  Array.from(categorias).forEach(categoria => {
    const dadosPorMes = {};
    
    Object.entries(dadosMensais).forEach(([mes, valores]) => {
      const mesNum = parseInt(mes.split('-')[1]) - 1; // 0-11
      if (!dadosPorMes[mesNum]) dadosPorMes[mesNum] = [];
      dadosPorMes[mesNum].push(valores[categoria] || 0);
    });
    
    // Calcular média mensal para detectar padrões sazonais
    const mediasMensais = {};
    Object.entries(dadosPorMes).forEach(([mes, valores]) => {
      mediasMensais[mes] = valores.reduce((a, b) => a + b, 0) / valores.length;
    });
    
    // Identificar meses com valores significativamente diferentes da média geral
    const valoresTodos = Object.values(mediasMensais);
    const mediaGeral = valoresTodos.reduce((a, b) => a + b, 0) / valoresTodos.length;
    
    const padraoSazonal = Object.entries(mediasMensais)
      .filter(([_, media]) => Math.abs(media - mediaGeral) > Math.abs(mediaGeral) * 0.2)
      .map(([mes, media]) => ({
        mes: parseInt(mes) + 1,
        media: media,
        desvio_percentual: ((media - mediaGeral) / Math.abs(mediaGeral)) * 100
      }));
    
    if (padraoSazonal.length > 0) {
      sazonalidade[categoria] = padraoSazonal;
    }
  });
  
  return sazonalidade;
}

function identificarAnomalias(dadosMensais, categorias) {
  const anomalias = [];
  const meses = Object.keys(dadosMensais).sort();
  
  Array.from(categorias).forEach(categoria => {
    const valores = meses.map(mes => dadosMensais[mes][categoria] || 0);
    
    // Calcular médias e desvios
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    const desvioPadrao = Math.sqrt(
      valores.reduce((sum, valor) => sum + Math.pow(valor - media, 2), 0) / valores.length
    );
    
    // Identificar valores fora de 2 desvios padrão
    valores.forEach((valor, index) => {
      if (Math.abs(valor - media) > 2 * desvioPadrao) {
        anomalias.push({
          mes: meses[index],
          categoria: categoria,
          valor: valor,
          media: media,
          desvio_padrao: desvioPadrao,
          severidade: Math.abs(valor - media) > 3 * desvioPadrao ? 'alta' : 'moderada'
        });
      }
    });
  });
  
  return anomalias;
}

// Endpoint para drill-down por linha DRE
app.get('/api/dre/drilldown/linha/:linhaDRE', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      dataInicio,
      dataFim,
      departamento
    } = req.query;

    const { linhaDRE } = req.params;

    console.log('📊 [API-DrillDown-Linha] Request - Filtros:', { 
      linhaDRE, dataInicio, dataFim, departamento 
    });

    const cacheKey = `drilldown_linha_${linhaDRE}_${JSON.stringify(req.query)}`;
    const cachedData = dataCache.get(cacheKey);

    if (cachedData) {
      const duration = Date.now() - startTime;
      console.log(`⚡ [API-DrillDown-Linha] Cache hit - ${duration}ms`);
      return res.json(cachedData);
    }

    if (!linhaDRE) {
      return res.status(400).json({ 
        error: 'Parâmetro obrigatório: linhaDRE' 
      });
    }

    const conditions = [];
    if (dataInicio) conditions.push(`data >= '${dataInicio}'`);
    if (dataFim) conditions.push(`data <= '${dataFim}'`);
    if (departamento) conditions.push(`departamento = '${departamento}'`);
    conditions.push(`linha_dre = '${decodeURIComponent(linhaDRE)}'`);

    // Query para drill-down com agregação por conta contábil e departamento
    const sqlQuery = `
      SELECT
        linha_dre,
        departamento,
        conta_contabil,
        clacon,
        COUNT(*) as quantidade_lancamentos,
        SUM(vl_rateado) as valor_total,
        MIN(data) as primeira_data,
        MAX(data) as ultima_data,
        AVG(vl_rateado) as valor_medio
      FROM (${DRE_SQL_BASE}) drill_data
      WHERE ${conditions.join(' AND ')}
      GROUP BY linha_dre, departamento, conta_contabil, clacon
      ORDER BY valor_total DESC
    `;

    console.log('🔍 [API-DrillDown-Linha] Executando consulta SQL...');
    const sqlStartTime = Date.now();
    const result = await executeSQL(sqlQuery);
    const sqlDuration = Date.now() - sqlStartTime;
    console.log(`✅ [API-DrillDown-Linha] SQL executado em ${sqlDuration}ms - ${result?.length || 0} registros`);

    // Processar dados adicionais
    const processados = (result || []).map(row => {
      const valorTotal = parseFloat(row.valor_total || 0);
      // Ajustar valores para despesas
      const valorAjustado = (row.linha_dre.includes('CPV') || 
                             (row.linha_dre.includes('DESPESAS') && !row.linha_dre.includes('PROVISAO'))) && 
                             !row.linha_dre.includes('RECEITAS') 
        ? -Math.abs(valorTotal) 
        : valorTotal;

      return {
        ...row,
        valor_ajustado: valorAjustado,
        percentual_total: 0 // será calculado abaixo
      };
    });

    // Calcular percentuais
    const valorTotalAbsoluto = Math.abs(processados.reduce((sum, item) => sum + item.valor_ajustado, 0));
    processados.forEach(item => {
      item.percentual_total = valorTotalAbsoluto > 0 ? (Math.abs(item.valor_ajustado) / valorTotalAbsoluto) * 100 : 0;
    });

    // Agrupar por departamento para resumo
    const resumoPorDepartamento = {};
    processados.forEach(item => {
      const dept = item.departamento || 'NÃO CLASSIFICADO';
      if (!resumoPorDepartamento[dept]) {
        resumoPorDepartamento[dept] = {
          departamento: dept,
          valor_total: 0,
          quantidade_lancamentos: 0,
          contas: []
        };
      }
      resumoPorDepartamento[dept].valor_total += item.valor_ajustado;
      resumoPorDepartamento[dept].quantidade_lancamentos += item.quantidade_lancamentos;
      resumoPorDepartamento[dept].contas.push({
        conta_contabil: item.conta_contabil,
        clacon: item.clacon,
        valor: item.valor_ajustado,
        quantidade: item.quantidade_lancamentos
      });
    });

    const response = {
      linha_dre: decodeURIComponent(linhaDRE),
      periodo: { dataInicio, dataFim },
      departamento_filtro: departamento,
      resumo: {
        valor_total: processados.reduce((sum, item) => sum + item.valor_ajustado, 0),
        quantidade_lancamentos: processados.reduce((sum, item) => sum + item.quantidade_lancamentos, 0),
        contas_unicas: new Set(processados.map(item => item.conta_contabil)).size,
        departamentos: Object.keys(resumoPorDepartamento).length
      },
      detalhes: processados,
      agrupado_por_departamento: Object.values(resumoPorDepartamento)
        .sort((a, b) => Math.abs(b.valor_total) - Math.abs(a.valor_total))
    };

    const totalDuration = Date.now() - startTime;
    console.log(`🚀 [API-DrillDown-Linha] Request completa em ${totalDuration}ms`);

    dataCache.set(cacheKey, response);
    res.json(response);

  } catch (error) {
    console.error('Erro ao buscar drill-down por linha DRE:', error);
    res.status(500).json({ error: 'Erro ao buscar drill-down', details: error.message });
  }
});

// Endpoint para drill-down por departamento
app.get('/api/dre/drilldown/departamento/:departamento', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      dataInicio,
      dataFim,
      linhaDRE
    } = req.query;

    const { departamento } = req.params;

    console.log('📊 [API-DrillDown-Depto] Request - Filtros:', { 
      departamento, dataInicio, dataFim, linhaDRE 
    });

    const cacheKey = `drilldown_depto_${departamento}_${JSON.stringify(req.query)}`;
    const cachedData = dataCache.get(cacheKey);

    if (cachedData) {
      const duration = Date.now() - startTime;
      console.log(`⚡ [API-DrillDown-Depto] Cache hit - ${duration}ms`);
      return res.json(cachedData);
    }

    if (!departamento) {
      return res.status(400).json({ 
        error: 'Parâmetro obrigatório: departamento' 
      });
    }

    const conditions = [];
    if (dataInicio) conditions.push(`data >= '${dataInicio}'`);
    if (dataFim) conditions.push(`data <= '${dataFim}'`);
    if (linhaDRE) conditions.push(`linha_dre = '${linhaDRE}'`);
    conditions.push(`departamento = '${decodeURIComponent(departamento)}'`);

    // Query para drill-down por departamento com detalhamento
    const sqlQuery = `
      SELECT
        linha_dre,
        departamento,
        conta_contabil,
        clacon,
        data,
        historico_contabil,
        origem_lanc,
        centro_resultado,
        vl_rateado,
        codigo_lanc
      FROM (${DRE_SQL_BASE}) drill_data
      WHERE ${conditions.join(' AND ')}
      ORDER BY data DESC, vl_rateado DESC
      LIMIT 500
    `;

    console.log('🔍 [API-DrillDown-Depto] Executando consulta SQL...');
    const sqlStartTime = Date.now();
    const result = await executeSQL(sqlQuery);
    const sqlDuration = Date.now() - sqlStartTime;
    console.log(`✅ [API-DrillDown-Depto] SQL executado em ${sqlDuration}ms - ${result?.length || 0} registros`);

    // Processar dados
    const processados = (result || []).map(row => {
      const valor = parseFloat(row.vl_rateado || 0);
      // Ajustar valores para despesas
      const valorAjustado = (row.linha_dre.includes('CPV') || 
                             (row.linha_dre.includes('DESPESAS') && !row.linha_dre.includes('PROVISAO'))) && 
                             !row.linha_dre.includes('RECEITAS') 
        ? -Math.abs(valor) 
        : valor;

      return {
        ...row,
        valor_ajustado: valorAjustado
      };
    });

    // Agrupar por linha DRE para resumo
    const resumoPorLinha = {};
    processados.forEach(item => {
      if (!resumoPorLinha[item.linha_dre]) {
        resumoPorLinha[item.linha_dre] = {
          linha_dre: item.linha_dre,
          valor_total: 0,
          quantidade_lancamentos: 0,
          contas: new Set(),
          primeiros_lancamentos: []
        };
      }
      resumoPorLinha[item.linha_dre].valor_total += item.valor_ajustado;
      resumoPorLinha[item.linha_dre].quantidade_lancamentos += 1;
      resumoPorLinha[item.linha_dre].contas.add(item.conta_contabil);
      
      if (resumoPorLinha[item.linha_dre].primeiros_lancamentos.length < 3) {
        resumoPorLinha[item.linha_dre].primeiros_lancamentos.push({
          data: item.data,
          historico: item.historico_contabil,
          valor: item.valor_ajustado,
          origem: item.origem_lanc
        });
      }
    });

    const response = {
      departamento: decodeURIComponent(departamento),
      periodo: { dataInicio, dataFim },
      linha_dre_filtro: linhaDRE,
      resumo: {
        valor_total: processados.reduce((sum, item) => sum + item.valor_ajustado, 0),
        quantidade_lancamentos: processados.length,
        contas_unicas: new Set(processados.map(item => item.conta_contabil)).size,
        linhas_dre: Object.keys(resumoPorLinha).length,
        data_primeiro_lancamento: processados.length > 0 ? processados[processados.length - 1].data : null,
        data_ultimo_lancamento: processados.length > 0 ? processados[0].data : null
      },
      agrupado_por_linha: Object.values(resumoPorLinha)
        .map(item => ({
          ...item,
          contas: Array.from(item.contas)
        }))
        .sort((a, b) => Math.abs(b.valor_total) - Math.abs(a.valor_total)),
      lancamentos_detalhados: processados.slice(0, 100) // Limitar para resposta
    };

    const totalDuration = Date.now() - startTime;
    console.log(`🚀 [API-DrillDown-Depto] Request completa em ${totalDuration}ms`);

    dataCache.set(cacheKey, response);
    res.json(response);

  } catch (error) {
    console.error('Erro ao buscar drill-down por departamento:', error);
    res.status(500).json({ error: 'Erro ao buscar drill-down', details: error.message });
  }
});

// Endpoint para busca de lançamentos específicos (drill-down final)
app.get('/api/dre/lancamentos', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      dataInicio,
      dataFim,
      departamento,
      linhaDRE,
      contaContabil,
      centroResultado,
      historico,
      page = 1,
      limit = 50
    } = req.query;

    console.log('📊 [API-Lancamentos] Request - Filtros:', { 
      dataInicio, dataFim, departamento, linhaDRE, contaContabil, centroResultado, historico, page, limit 
    });

    const cacheKey = `lancamentos_${JSON.stringify(req.query)}`;
    const cachedData = dataCache.get(cacheKey);

    if (cachedData) {
      const duration = Date.now() - startTime;
      console.log(`⚡ [API-Lancamentos] Cache hit - ${duration}ms`);
      return res.json(cachedData);
    }

    const conditions = [];
    if (dataInicio) conditions.push(`data >= '${dataInicio}'`);
    if (dataFim) conditions.push(`data <= '${dataFim}'`);
    if (departamento) conditions.push(`departamento = '${departamento}'`);
    if (linhaDRE) conditions.push(`linha_dre = '${linhaDRE}'`);
    if (contaContabil) conditions.push(`conta_contabil ILIKE '%${contaContabil}%'`);
    if (centroResultado) conditions.push(`centro_resultado ILIKE '%${centroResultado}%'`);
    if (historico) conditions.push(`historico_contabil ILIKE '%${historico}%'`);

    if (conditions.length === 0) {
      return res.status(400).json({ 
        error: 'É necessário informar pelo menos um filtro' 
      });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Query para lançamentos detalhados
    const sqlQuery = buildFilteredQuery(
      `SELECT
        data,
        linha_dre,
        departamento,
        conta_contabil,
        clacon,
        historico_contabil,
        origem_lanc,
        centro_resultado,
        vl_rateado,
        codigo_lanc,
        g1,
        g2,
        g3
       FROM (${DRE_SQL_BASE}) lancamentos`,
      conditions,
      'data DESC, vl_rateado DESC',
      parseInt(limit),
      offset
    );

    console.log('🔍 [API-Lancamentos] Executando consulta SQL...');
    const sqlStartTime = Date.now();
    const result = await executeSQL(sqlQuery);
    const sqlDuration = Date.now() - sqlStartTime;
    console.log(`✅ [API-Lancamentos] SQL executado em ${sqlDuration}ms - ${result?.length || 0} registros`);

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM (${DRE_SQL_BASE}) lancamentos 
      WHERE ${conditions.join(' AND ')}
    `;
    
    const countStartTime = Date.now();
    const countResult = await executeSQL(countQuery);
    const total = parseInt(countResult[0]?.total || 0);
    const countDuration = Date.now() - countStartTime;
    console.log(`✅ [API-Lancamentos] Count executado em ${countDuration}ms - Total: ${total}`);

    // Processar dados
    const processados = (result || []).map(row => {
      const valor = parseFloat(row.vl_rateado || 0);
      // Ajustar valores para despesas
      const valorAjustado = (row.linha_dre.includes('CPV') || 
                             (row.linha_dre.includes('DESPESAS') && !row.linha_dre.includes('PROVISAO'))) && 
                             !row.linha_dre.includes('RECEITAS') 
        ? -Math.abs(valor) 
        : valor;

      return {
        ...row,
        valor_ajustado: valorAjustado
      };
    });

    const response = {
      data: processados,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      filtros_aplicados: {
        dataInicio,
        dataFim,
        departamento,
        linhaDRE,
        contaContabil,
        centroResultado,
        historico
      },
      resumo: {
        valor_total: processados.reduce((sum, item) => sum + item.valor_ajustado, 0),
        quantidade_lancamentos: processados.length
      }
    };

    const totalDuration = Date.now() - startTime;
    console.log(`🚀 [API-Lancamentos] Request completa em ${totalDuration}ms`);

    dataCache.set(cacheKey, response);
    res.json(response);

  } catch (error) {
    console.error('Erro ao buscar lançamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar lançamentos', details: error.message });
  }
});

// Cache para configurações de alertas (em produção usar Redis/DB)
const alertCache = new NodeCache({ stdTTL: 86400 }); // 24h

// Endpoint para criar/configurar alertas
app.post('/api/alerts', async (req, res) => {
  try {
    const {
      nome,
      descricao,
      tipo,
      linha_dre,
      departamento,
      condicao,
      valor_limiar,
      operador = '>',
      email_destino,
      ativo = true
    } = req.body;

    console.log('🔔 [API-Alerts-Create] Criando alerta:', { nome, tipo, linha_dre, departamento, condicao, valor_limiar });

    // Validar campos obrigatórios
    if (!nome || !tipo || !condicao || valor_limiar === undefined) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: nome, tipo, condicao, valor_limiar' 
      });
    }

    // Gerar ID para o alerta
    const alertId = Date.now().toString();
    const alerta = {
      id: alertId,
      nome,
      descricao,
      tipo, // 'limiar', 'variacao', 'anomalia'
      linha_dre,
      departamento,
      condicao, // 'valor_acima', 'valor_abaixo', 'variacao_percentual', 'anomalia'
      valor_limiar: parseFloat(valor_limiar),
      operador,
      email_destino,
      ativo,
      criado_em: new Date().toISOString(),
      ultima_verificacao: null,
      disparos: 0,
      ultimo_disparo: null
    };

    // Salvar no cache (em produção usar DB)
    const alertasExistentes = alertCache.get('alertas') || [];
    alertasExistentes.push(alerta);
    alertCache.set('alertas', alertasExistentes);

    console.log(`✅ [API-Alerts-Create] Alerta ${alertId} criado com sucesso`);
    res.status(201).json(alerta);

  } catch (error) {
    console.error('Erro ao criar alerta:', error);
    res.status(500).json({ error: 'Erro ao criar alerta', details: error.message });
  }
});

// Endpoint para listar alertas
app.get('/api/alerts', async (req, res) => {
  try {
    const { ativo } = req.query;
    console.log('🔔 [API-Alerts-List] Listando alertas - Ativo:', ativo);

    let alertas = alertCache.get('alertas') || [];
    
    if (ativo !== undefined) {
      const isAtivo = ativo === 'true';
      alertas = alertas.filter(alerta => alerta.ativo === isAtivo);
    }

    res.json(alertas);

  } catch (error) {
    console.error('Erro ao listar alertas:', error);
    res.status(500).json({ error: 'Erro ao listar alertas', details: error.message });
  }
});

// Endpoint para atualizar alerta
app.put('/api/alerts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log('🔔 [API-Alerts-Update] Atualizando alerta:', id, updates);

    const alertas = alertCache.get('alertas') || [];
    const alertaIndex = alertas.findIndex(a => a.id === id);

    if (alertaIndex === -1) {
      return res.status(404).json({ error: 'Alerta não encontrado' });
    }

    // Atualizar apenas os campos fornecidos
    alertas[alertaIndex] = {
      ...alertas[alertaIndex],
      ...updates,
      atualizado_em: new Date().toISOString()
    };

    alertCache.set('alertas', alertas);

    console.log(`✅ [API-Alerts-Update] Alerta ${id} atualizado com sucesso`);
    res.json(alertas[alertaIndex]);

  } catch (error) {
    console.error('Erro ao atualizar alerta:', error);
    res.status(500).json({ error: 'Erro ao atualizar alerta', details: error.message });
  }
});

// Endpoint para excluir alerta
app.delete('/api/alerts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔔 [API-Alerts-Delete] Excluindo alerta:', id);

    const alertas = alertCache.get('alertas') || [];
    const alertaIndex = alertas.findIndex(a => a.id === id);

    if (alertaIndex === -1) {
      return res.status(404).json({ error: 'Alerta não encontrado' });
    }

    const alertaExcluido = alertas.splice(alertaIndex, 1)[0];
    alertCache.set('alertas', alertas);

    console.log(`✅ [API-Alerts-Delete] Alerta ${id} excluído com sucesso`);
    res.json({ message: 'Alerta excluído com sucesso', alerta: alertaExcluido });

  } catch (error) {
    console.error('Erro ao excluir alerta:', error);
    res.status(500).json({ error: 'Erro ao excluir alerta', details: error.message });
  }
});

// Endpoint para verificar alertas
app.post('/api/alerts/verificar', async (req, res) => {
  const startTime = Date.now();
  try {
    const { dataInicio, dataFim, dataInicioComparacao, dataFimComparacao } = req.body;

    console.log('🔔 [API-Alerts-Check] Verificando alertas - Períodos:', { 
      dataInicio, dataFim, dataInicioComparacao, dataFimComparacao 
    });

    const alertas = alertCache.get('alertas') || [];
    const alertasAtivos = alertas.filter(a => a.ativo);

    if (alertasAtivos.length === 0) {
      return res.json({ message: 'Nenhum alerta ativo para verificar', disparos: [] });
    }

    const disparos = [];

    for (const alerta of alertasAtivos) {
      try {
        const resultado = await verificarAlerta(alerta, {
          dataInicio,
          dataFim,
          dataInicioComparacao,
          dataFimComparacao
        });

        if (resultado.disparado) {
          disparos.push({
            alerta_id: alerta.id,
            alerta_nome: alerta.nome,
            tipo: alerta.tipo,
            condicao: alerta.condicao,
            mensagem: resultado.mensagem,
            valor_atual: resultado.valor_atual,
            valor_limiar: alerta.valor_limiar,
            data_verificacao: new Date().toISOString()
          });

          // Atualizar estatísticas do alerta
          const alertasAtualizados = alertCache.get('alertas') || [];
          const alertaIndex = alertasAtualizados.findIndex(a => a.id === alerta.id);
          if (alertaIndex !== -1) {
            alertasAtualizados[alertaIndex].ultima_verificacao = new Date().toISOString();
            alertasAtualizados[alertaIndex].disparos += 1;
            alertasAtualizados[alertaIndex].ultimo_disparo = new Date().toISOString();
            alertCache.set('alertas', alertasAtualizados);
          }
        }
      } catch (error) {
        console.error(`Erro ao verificar alerta ${alerta.id}:`, error);
      }
    }

    const response = {
      message: `Verificação concluída. ${disparos.length} alertas disparados.`,
      total_verificados: alertasAtivos.length,
      total_disparados: disparos.length,
      disparos: disparos
    };

    const duration = Date.now() - startTime;
    console.log(`🚀 [API-Alerts-Check] Verificação completa em ${duration}ms - ${disparos.length} disparos`);

    res.json(response);

  } catch (error) {
    console.error('Erro na verificação de alertas:', error);
    res.status(500).json({ error: 'Erro na verificação de alertas', details: error.message });
  }
});

// Endpoint para listar histórico de disparos
app.get('/api/alerts/historico', async (req, res) => {
  try {
    const { alerta_id, dias = 30 } = req.query;
    console.log('🔔 [API-Alerts-History] Consultando histórico - Alerta:', alerta_id, 'Dias:', dias);

    // Em produção, usar tabela de histórico no DB
    // Por ora, vamos simular com dados do cache
    const disparos = alertCache.get('historico_disparos') || [];
    
    let disparosFiltrados = disparos;
    
    if (alerta_id) {
      disparosFiltrados = disparos.filter(d => d.alerta_id === alerta_id);
    }

    // Filtrar por período
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - parseInt(dias));
    
    disparosFiltrados = disparosFiltrados.filter(d => 
      new Date(d.data_verificacao) >= dataLimite
    );

    // Ordenar por data decrescente
    disparosFiltrados.sort((a, b) => 
      new Date(b.data_verificacao) - new Date(a.data_verificacao)
    );

    res.json(disparosFiltrados);

  } catch (error) {
    console.error('Erro ao consultar histórico:', error);
    res.status(500).json({ error: 'Erro ao consultar histórico', details: error.message });
  }
});

// Função auxiliar para verificar um alerta específico
async function verificarAlerta(alerta, periodos) {
  const { dataInicio, dataFim, dataInicioComparacao, dataFimComparacao } = periodos;

  try {
    switch (alerta.condicao) {
      case 'valor_acima':
      case 'valor_abaixo':
        return await verificarAlertaValor(alerta, dataInicio, dataFim);
      
      case 'variacao_percentual':
        if (!dataInicioComparacao || !dataFimComparacao) {
          throw new Error('Períodos de comparação são obrigatórios para alertas de variação');
        }
        return await verificarAlertaVariacao(alerta, dataInicio, dataFim, dataInicioComparacao, dataFimComparacao);
      
      case 'anomalia':
        return await verificarAlertaAnomalia(alerta, dataInicio, dataFim);
      
      default:
        throw new Error(`Condição de alerta não suportada: ${alerta.condicao}`);
    }
  } catch (error) {
    console.error(`Erro ao verificar alerta ${alerta.id}:`, error);
    return { disparado: false, erro: error.message };
  }
}

async function verificarAlertaValor(alerta, dataInicio, dataFim) {
  const conditions = [];
  if (dataInicio) conditions.push(`data >= '${dataInicio}'`);
  if (dataFim) conditions.push(`data <= '${dataFim}'`);
  if (alerta.linha_dre) conditions.push(`linha_dre = '${alerta.linha_dre}'`);
  if (alerta.departamento) conditions.push(`departamento = '${alerta.departamento}'`);

  const sqlQuery = `
    SELECT SUM(vl_rateado) as valor_total
    FROM (${DRE_SQL_BASE}) alert_data
    WHERE ${conditions.join(' AND ')}
  `;

  const result = await executeSQL(sqlQuery);
  const valorAtual = parseFloat(result[0]?.valor_total || 0);

  // Ajustar valor para despesas (negativo)
  const valorAjustado = (alerta.linha_dre?.includes('DESPESAS') || alerta.linha_dre?.includes('CPV')) && 
                        !alerta.linha_dre?.includes('RECEITAS') 
    ? -Math.abs(valorAtual) 
    : valorAtual;

  const disparado = alerta.operador === '>' 
    ? valorAjustado > alerta.valor_limiar
    : valorAjustado < alerta.valor_limiar;

  const mensagem = disparado 
    ? `Alerta: ${alerta.nome} - Valor atual ${formatarMoeda(valorAjustado)} ${alerta.operador} ${formatarMoeda(alerta.valor_limiar)}`
    : '';

  return {
    disparado,
    mensagem,
    valor_atual: valorAjustado
  };
}

async function verificarAlertaVariacao(alerta, dataInicio, dataFim, dataInicioComp, dataFimComp) {
  // Buscar dados do período atual
  const valorAtual = await buscarValorPeriodo(alerta, dataInicio, dataFim);
  
  // Buscar dados do período anterior
  const valorAnterior = await buscarValorPeriodo(alerta, dataInicioComp, dataFimComp);

  const variacaoPercentual = valorAnterior !== 0 
    ? ((valorAtual - valorAnterior) / Math.abs(valorAnterior)) * 100 
    : 0;

  const disparado = alerta.operador === '>' 
    ? Math.abs(variacaoPercentual) > alerta.valor_limiar
    : Math.abs(variacaoPercentual) < alerta.valor_limiar;

  const mensagem = disparado 
    ? `Alerta: ${alerta.nome} - Variação de ${variacaoPercentual.toFixed(2)}% ${alerta.operador} ${alerta.valor_limiar}%`
    : '';

  return {
    disparado,
    mensagem,
    valor_atual: variacaoPercentual
  };
}

async function verificarAlertaAnomalia(alerta, dataInicio, dataFim) {
  // Implementação básica - verificar valores fora do padrão
  // Em produção, usar algoritmos mais sofisticados
  const valorAtual = await buscarValorPeriodo(alerta, dataInicio, dataFim);
  
  // Simplificado: disparar se valor for muito diferente de zero
  const disparado = Math.abs(valorAtual) > alerta.valor_limiar;

  const mensagem = disparado 
    ? `Alerta: ${alerta.nome} - Detectada anomalia de valor ${formatarMoeda(valorAtual)}`
    : '';

  return {
    disparado,
    mensagem,
    valor_atual: valorAtual
  };
}

async function buscarValorPeriodo(alerta, dataInicio, dataFim) {
  const conditions = [];
  if (dataInicio) conditions.push(`data >= '${dataInicio}'`);
  if (dataFim) conditions.push(`data <= '${dataFim}'`);
  if (alerta.linha_dre) conditions.push(`linha_dre = '${alerta.linha_dre}'`);
  if (alerta.departamento) conditions.push(`departamento = '${alerta.departamento}'`);

  const sqlQuery = `
    SELECT SUM(vl_rateado) as valor_total
    FROM (${DRE_SQL_BASE}) alert_data
    WHERE ${conditions.join(' AND ')}
  `;

  const result = await executeSQL(sqlQuery);
  let valor = parseFloat(result[0]?.valor_total || 0);

  // Ajustar valor para despesas (negativo)
  valor = (alerta.linha_dre?.includes('DESPESAS') || alerta.linha_dre?.includes('CPV')) && 
          !alerta.linha_dre?.includes('RECEITAS') 
    ? -Math.abs(valor) 
    : valor;

  return valor;
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

// Endpoint para exportação em PDF
app.get('/api/export/pdf', async (req, res) => {
  const startTime = Date.now();
  let browser;
  try {
    const {
      dataInicio,
      dataFim,
      departamento,
      linhaDRE,
      type = 'resumido'
    } = req.query;

    console.log('📊 [API-Export-PDF] Request - Filtros:', { dataInicio, dataFim, departamento, linhaDRE, type });

    const cacheKey = `export_pdf_${JSON.stringify(req.query)}`;
    const cachedData = dataCache.get(cacheKey);

    if (cachedData) {
      const duration = Date.now() - startTime;
      console.log(`⚡ [API-Export-PDF] Cache hit - ${duration}ms`);
      return res.setHeader('Content-Type', 'application/pdf')
               .setHeader('Content-Disposition', `attachment; filename="dre_export_${type}_${new Date().toISOString().split('T')[0]}.pdf"`)
               .send(cachedData);
    }

    const conditions = [];
    if (dataInicio) conditions.push(`data >= '${dataInicio}'`);
    if (dataFim) conditions.push(`data <= '${dataFim}'`);
    if (departamento) conditions.push(`departamento = '${departamento}'`);
    if (linhaDRE) conditions.push(`linha_dre = '${linhaDRE}'`);

    let result;
    
    if (type === 'resumido') {
      // Exportação resumida - agrupada por linha DRE
      const sqlQuery = `
        SELECT
          linha_dre,
          SUM(vl_rateado) as valor_total,
          COUNT(*) as quantidade_lancamentos
        FROM (${DRE_SQL_BASE}) export_data
        ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
        GROUP BY linha_dre
        ORDER BY linha_dre
      `;
      
      console.log('🔍 [API-Export-PDF] Executando consulta SQL resumida...');
      const sqlStartTime = Date.now();
      result = await executeSQL(sqlQuery);
      const sqlDuration = Date.now() - sqlStartTime;
      console.log(`✅ [API-Export-PDF] SQL resumido executado em ${sqlDuration}ms - ${result?.length || 0} registros`);
    } else {
      // Exportação detalhada
      const sqlQuery = buildFilteredQuery(
        DRE_SQL_BASE,
        conditions,
        'data DESC, linha_dre',
        1000, // Limite para PDF
        0
      );
      
      console.log('🔍 [API-Export-PDF] Executando consulta SQL detalhada...');
      const sqlStartTime = Date.now();
      result = await executeSQL(sqlQuery);
      const sqlDuration = Date.now() - sqlStartTime;
      console.log(`✅ [API-Export-PDF] SQL detalhada executado em ${sqlDuration}ms - ${result?.length || 0} registros`);
    }

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Nenhum dado encontrado para exportação' });
    }

    // Gerar HTML para o PDF
    const html = generatePDFHTML(result, type, { dataInicio, dataFim, departamento, linhaDRE });

    // Launch browser
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });

    await browser.close();

    const totalDuration = Date.now() - startTime;
    console.log(`🚀 [API-Export-PDF] Exportação completa em ${totalDuration}ms`);

    // Cache do PDF
    dataCache.set(cacheKey, pdfBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="dre_export_${type}_${new Date().toISOString().split('T')[0]}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Erro na exportação PDF:', error);
    if (browser) await browser.close();
    res.status(500).json({ error: 'Erro ao exportar PDF', details: error.message });
  }
});

// Função para gerar HTML para PDF
function generatePDFHTML(data, type, filters) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value) => {
    const num = parseFloat(value || 0);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(num);
  };

  const header = `
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
      <h1 style="margin: 0; color: #333;">Dashboard DRE - AGROSS</h1>
      <h2 style="margin: 5px 0; color: #666;">Demonstração de Resultados do Exercício</h2>
      <p style="margin: 5px 0; color: #888; font-size: 14px;">
        Gerado em ${new Date().toLocaleString('pt-BR')}
        ${filters.dataInicio || filters.dataFim ? 
          `<br>Período: ${formatDate(filters.dataInicio)} à ${formatDate(filters.dataFim)}` : 
          ''}
        ${filters.departamento ? `<br>Departamento: ${filters.departamento}` : ''}
      </p>
    </div>
  `;

  let content = '';
  
  if (type === 'resumido') {
    // Tabela resumida
    content = `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
            <th style="padding: 12px; text-align: left; border: 1px solid #dee2e6; font-weight: bold;">Linha DRE</th>
            <th style="padding: 12px; text-align: right; border: 1px solid #dee2e6; font-weight: bold;">Valor Total</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #dee2e6; font-weight: bold;">Qtd. Lançamentos</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr style="border-bottom: 1px solid #dee2e6;">
              <td style="padding: 10px; border: 1px solid #dee2e6; vertical-align: top;">${row.linha_dre}</td>
              <td style="padding: 10px; text-align: right; border: 1px solid #dee2e6; font-weight: bold;">${formatCurrency(row.valor_total)}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">${row.quantidade_lancamentos}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background-color: #f8f9fa; border-top: 2px solid #333;">
            <th style="padding: 12px; text-align: left; border: 1px solid #dee2e6;">TOTAL GERAL</th>
            <th style="padding: 12px; text-align: right; border: 1px solid #dee2e6; font-weight: bold;">${formatCurrency(data.reduce((sum, row) => sum + parseFloat(row.valor_total || 0), 0))}</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #dee2e6; font-weight: bold;">${data.reduce((sum, row) => sum + parseInt(row.quantidade_lancamentos || 0), 0)}</th>
          </tr>
        </tfoot>
      </table>
    `;
  } else {
    // Tabela detalhada (limitada para PDF)
    content = `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px;">
        <thead>
          <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
            <th style="padding: 8px; text-align: left; border: 1px solid #dee2e6; font-weight: bold;">Data</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #dee2e6; font-weight: bold;">Linha DRE</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #dee2e6; font-weight: bold;">Departamento</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #dee2e6; font-weight: bold;">Conta Contábil</th>
            <th style="padding: 8px; text-align: right; border: 1px solid #dee2e6; font-weight: bold;">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${data.slice(0, 50).map(row => `
            <tr style="border-bottom: 1px solid #dee2e6;">
              <td style="padding: 6px; border: 1px solid #dee2e6;">${formatDate(row.data)}</td>
              <td style="padding: 6px; border: 1px solid #dee2e6; vertical-align: top; max-width: 200px; word-wrap: break-word;">${row.linha_dre}</td>
              <td style="padding: 6px; border: 1px solid #dee2e6;">${row.departamento || '-'}</td>
              <td style="padding: 6px; border: 1px solid #dee2e6; max-width: 150px; word-wrap: break-word;">${row.conta_contabil || '-'}</td>
              <td style="padding: 6px; text-align: right; border: 1px solid #dee2e6; font-weight: bold;">${formatCurrency(row.vl_rateado)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${data.length > 50 ? `<p style="color: #666; font-style: italic; margin-top: 10px;">* Mostrando primeiros 50 registros de ${data.length} totais</p>` : ''}
    `;
  }

  const footer = `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">
      <p>Documento gerado automaticamente pelo Dashboard DRE - AGROSS</p>
      <p>Confidencial - Uso Interno</p>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Dashboard DRE - Relatório PDF</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          color: #333;
        }
        table {
          page-break-inside: avoid;
        }
        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
      </style>
    </head>
    <body>
      ${header}
      ${content}
      ${footer}
    </body>
    </html>
  `;
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Servidor DRE Dashboard rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});

module.exports = app;
