#!/usr/bin/env node

/**
 * Migration Script
 * Executa migrations SQL na base de dados
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configurações do DB
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'agross',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres'
};

async function runMigration() {
  const { Pool } = require('pg');
  
  console.log('🔄 [Migration] Iniciando execução de migrations...');
  
  const pool = new Pool(dbConfig);
  
  try {
    // Criar tabela de migrations se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Ler arquivos de migration
    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    for (const file of migrationFiles) {
      console.log(`📋 [Migration] Verificando: ${file}`);
      
      // Verificar se migration já foi executada
      const result = await pool.query(
        'SELECT id FROM migrations WHERE filename = $1',
        [file]
      );
      
      if (result.rows.length > 0) {
        console.log(`⏭️  [Migration] ${file} já executada, ignorando.`);
        continue;
      }
      
      // Ler e executar migration
      console.log(`🚀 [Migration] Executando: ${file}`);
      const migrationSQL = fs.readFileSync(
        path.join(migrationsDir, file),
        'utf8'
      );
      
      await pool.query(migrationSQL);
      
      // Registrar migration como executada
      await pool.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [file]
      );
      
      console.log(`✅ [Migration] ${file} executada com sucesso.`);
    }
    
    console.log('🎉 [Migration] Todas as migrations executadas!');
    
    // Mostrar estatísticas dos índices criados
    await showIndexStats(pool);
    
  } catch (error) {
    console.error('❌ [Migration] Erro ao executar migrations:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function showIndexStats(pool) {
  try {
    console.log('\n📊 [Index Stats] Estatísticas de uso dos índices:');
    
    const result = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch,
        pg_size_pretty(pg_relation_size(indexrelid::regclass)) as size
      FROM pg_stat_user_indexes 
      WHERE schemaname = 'public' 
        AND (tablename = 'dre_data' OR tablename = 'dre_cache')
      ORDER BY idx_scan DESC, tablename, indexname
    `);
    
    if (result.rows.length === 0) {
      console.log('Nenhum índice encontrado nas tabelas dre_data ou dre_cache');
      return;
    }
    
    console.table(result.rows, [
      'tablename',
      'indexname',
      'idx_scan',
      'size'
    ]);
    
  } catch (error) {
    console.log('Não foi possível obter estatísticas dos índices:', error.message);
  }
}

// Executar migration se chamado diretamente
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
