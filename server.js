require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 13456;
console.log('🔧 [Server] PORT do .env:', process.env.PORT);
console.log('🔧 [Server] PORT final:', PORT);

// Middleware
if (process.env.NODE_ENV !== 'development') {
  app.use(helmet());
}
app.use(compression());
app.use(cors({
  origin: ['http://localhost:13456', 'http://127.0.0.1:13456'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cache configuration
const tokenCache = new NodeCache({ stdTTL: 3000 }); // 50 minutos para token
const dataCache = new NodeCache({ stdTTL: 1800 }); // 30 minutos para dados

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

// Endpoint para dados DRE com paginacao
app.get('/api/dre', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      dataInicio,
      dataFim,
      departamento,
      linhaDRE,
      page = 1,
      limit = 100
    } = req.query;

    console.log(`📊 [API-DRE] Request - Page: ${page}, Limit: ${limit}`);
    console.log(`📊 [API-DRE] Filtros:`, { dataInicio, dataFim, departamento, linhaDRE });

    const cacheKey = `dre_${JSON.stringify(req.query)}`;
    const cachedData = dataCache.get(cacheKey);

    if (cachedData) {
      const duration = Date.now() - startTime;
      console.log(`⚡ [API-DRE] Cache hit - ${duration}ms`);
      return res.json(cachedData);
    }

    const conditions = [];
    if (dataInicio) conditions.push(`data >= '${dataInicio}'`);
    if (dataFim) conditions.push(`data <= '${dataFim}'`);
    if (departamento) conditions.push(`departamento = '${departamento}'`);
    if (linhaDRE) conditions.push(`linha_dre = '${linhaDRE}'`);

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Query com filtros e paginacao
    const sqlQuery = buildFilteredQuery(
      DRE_SQL_BASE,
      conditions,
      'data DESC',
      parseInt(limit),
      offset
    );

    console.log(`🔍 [API-DRE] Executando consulta SQL...`);
    const sqlStartTime = Date.now();
    const result = await executeSQL(sqlQuery);
    const sqlDuration = Date.now() - sqlStartTime;
    console.log(`✅ [API-DRE] SQL executado em ${sqlDuration}ms - ${result?.length || 0} registros`);

    // Query para contar total (sem paginacao)
    const countStartTime = Date.now();
    const countQuery = `SELECT COUNT(*) as total FROM (${DRE_SQL_BASE}) count_data${conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''}`;
    const countResult = await executeSQL(countQuery);
    const total = parseInt(countResult[0]?.total || 0);
    const countDuration = Date.now() - countStartTime;
    console.log(`✅ [API-DRE] Count executado em ${countDuration}ms - Total: ${total}`);

    const response = {
      data: result || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    };

    const totalDuration = Date.now() - startTime;
    console.log(`🚀 [API-DRE] Request completa em ${totalDuration}ms`);

    dataCache.set(cacheKey, response);
    res.json(response);

  } catch (error) {
    console.error('Erro ao buscar dados DRE:', error);
    res.status(500).json({ error: 'Erro ao buscar dados DRE', details: error.message });
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
      return {
        linha_dre: line,
        valor_total: lineData.reduce((sum, item) => sum + parseFloat(item.valor_total || 0), 0),
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
