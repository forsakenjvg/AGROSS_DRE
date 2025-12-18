-- Migration para criar índices de performance
-- Created: 2025-01-13
-- Purpose: Otimizar queries do dashboard DRE

-- Índice primário na tabela principal (se não existir)
CREATE INDEX IF NOT EXISTS idx_dre_data_id ON dre_data(id);

-- Índice composto para filtros mais comuns
CREATE INDEX IF NOT EXISTS idx_dre_data_filtros ON dre_data(data, departamento, linha_dre);

-- Índice para busca por histórico
CREATE INDEX IF NOT EXISTS idx_dre_data_historico ON dre_data USING gin(to_tsvector('portuguese', historico_contabil));

-- Índice para valores (ordenamentos)
CREATE INDEX IF NOT EXISTS idx_dre_data_valor ON dre_data(vl_rateado);

-- Índice para tipo
CREATE INDEX IF NOT EXISTS idx_dre_data_tipo ON dre_data(tipo);

-- Índice para código de lançamento
CREATE INDEX IF NOT EXISTS idx_dre_data_codigo ON dre_data(codigo_lanc);

-- Índice para origem
CREATE INDEX IF NOT EXISTS idx_dre_data_origem ON dre_data(origem_lanc);

-- Índice para data de criação (cache invalidation)
CREATE INDEX IF NOT EXISTS idx_dre_data_created_at ON dre_data(created_at);

-- Índice para data de atualização
CREATE INDEX IF NOT EXISTS idx_dre_data_updated_at ON dre_data(updated_at);

-- Índice parcial para valores não nulos (performance)
CREATE INDEX IF NOT EXISTS idx_dre_data_valor_not_null ON dre_data(vl_rateado) WHERE vl_rateado IS NOT NULL;

-- Índice parcial para receitas (valores positivos)
CREATE INDEX IF NOT EXISTS idx_dre_data_receitas ON dre_data(vl_rateado, data) WHERE vl_rateado > 0;

-- Índice parcial para despesas (valores negativos)
CREATE INDEX IF NOT EXISTS idx_dre_data_despesas ON dre_data(vl_rateado, data) WHERE vl_rateado < 0;

-- Índice composto para aggregates por linha DRE
CREATE INDEX IF NOT EXISTS idx_dre_data_linha_agg ON dre_data(linha_dre, vl_rateado);

-- Índice composto para aggregates por departamento
CREATE INDEX IF NOT EXISTS idx_dre_data_depto_agg ON dre_data(departamento, vl_rateado);

-- Índice composto para mensal
CREATE INDEX IF NOT EXISTS idx_dre_data_mensal ON dre_data(date_trunc('month', data), linha_dre, vl_rateado);

-- Índice para cache table
CREATE INDEX IF NOT EXISTS idx_dre_cache_key ON dre_cache(cache_key);

-- Índice para expiração de cache
CREATE INDEX IF NOT EXISTS idx_dre_cache_expires_at ON dre_cache(expires_at);

-- Analisar tabelas após criar índices
ANALYZE dre_data;
ANALYZE dre_cache;

-- Atualizar estatísticas do PostgreSQL
-- Isso ajuda o planner a escolher melhores planos de execução
UPDATE pg_statistics 
SET most_common_vals = null, most_common_freqs = null 
WHERE schemaname = 'public' AND tablename IN ('dre_data', 'dre_cache');

-- Comentar sobre uso
-- Estes índices foram criados para otimizar as seguintes queries:
-- 1. Filtros por data + departamento + linha DRE
-- 2. Busca full-text no histórico
-- 3. Ordenações por valor
-- 4. Aggregates por período
-- 5. Cache lookups

-- Monitore o desempenho com:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY idx_scan DESC;
