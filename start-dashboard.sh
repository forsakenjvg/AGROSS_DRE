#!/bin/bash

echo "==================================="
echo "🚀 Iniciando Dashboard DRE - AGROSS"
echo "==================================="

# Matar processos existentes
pkill -f "node server.js" 2>/dev/null || true
sleep 2

# Iniciar servidor na porta correta
cd "$(dirname "$0")"
PORT=13456 npm start > dashboard.log 2>&1 &

# Aguardar servidor iniciar
sleep 3

# Verificar se iniciou
if curl -s "http://localhost:13456/api/health" > /dev/null; then
    echo ""
    echo "✅ Dashboard DRE iniciado com sucesso!"
    echo ""
    echo "📱 Acesse em: http://localhost:13456"
    echo ""
    echo "🔍 Para ver os logs de console:"
    echo "   1. Abra http://localhost:13456 no navegador"
    echo "   2. Pressione F12 para abrir as ferramentas de desenvolvedor"
    echo "   3. Vá para a aba 'Console'"
    echo ""
    echo "📊 Logs do servidor:"
    echo "   tail -f dashboard.log"
    echo ""
else
    echo "❌ Falha ao iniciar o servidor"
    echo "Verifique os logs em: dashboard.log"
fi
