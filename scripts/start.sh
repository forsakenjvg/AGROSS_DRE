#!/bin/bash

# Script de inicialização do Dashboard DRE
# Verifica dependências, configura ambiente e inicia o servidor

echo "🚀 Iniciando Dashboard DRE - AGROSS"
echo "====================================="

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Por favor, instale Node.js 14+"
    exit 1
fi

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado. Por favor, instale npm"
    exit 1
fi

# Exibir versões
echo "📋 Versões:"
echo "   Node.js: $(node --version)"
echo "   npm: $(npm --version)"

# Verificar se node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Falha ao instalar dependências"
        exit 1
    fi
else
    echo "✅ Dependências já instaladas"
fi

# Verificar porta 13456
if lsof -Pi :13456 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Porta 13456 já está em uso"
    echo "   Tentando finalizar processo existente..."
    lsof -ti:13456 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Set environment variables
export NODE_ENV=${NODE_ENV:-development}
export PORT=${PORT:-13456}
export CACHE_TTL_TOKEN=${CACHE_TTL_TOKEN:-3000}
export CACHE_TTL_DATA=${CACHE_TTL_DATA:-1800}

echo ""
echo "⚙️  Configuração:"
echo "   Ambiente: $NODE_ENV"
echo "   Porta: $PORT"
echo "   Cache Token: ${CACHE_TTL_TOKEN}s"
echo "   Cache Data: ${CACHE_TTL_DATA}s"

echo ""
echo "🔧 Iniciando servidor..."
echo "   Dashboard: http://localhost:$PORT"
echo "   Health: http://localhost:$PORT/api/health"

# Iniciar servidor
if [ "$NODE_ENV" = "development" ]; then
    echo "🛠️  Modo desenvolvimento (com auto-reload)"
    npm run dev
else
    echo "🚀 Modo produção"
    npm start
fi
