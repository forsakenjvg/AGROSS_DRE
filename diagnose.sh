#!/bin/bash

echo "========================================"
echo "🔍 Diagnóstico do Dashboard DRE"
echo "========================================"

echo ""
echo "1️⃣ Verificando processos Node..."
ps aux | grep -E "node.*server.js" | grep -v grep || echo "   ❌ Nenhum processo server.js encontrado"

echo ""
echo "2️⃣ Verificando portas em uso..."
echo "   Porta 3000:" $(lsof -i:3000 2>/dev/null | wc -l) "processos"
echo "   Porta 13456:" $(lsof -i:13456 2>/dev/null | wc -l) "processos"

echo ""
echo "3️⃣ Testando conexão HTTP..."
if curl -s "http://localhost:13456/api/health" > /dev/null; then
    echo "   ✅ Servidor respondendo em http://localhost:13456"
    echo ""
    echo "4️⃣ Mostrando últimas 5 linhas do log:"
    tail -5 dashboard.log 2>/dev/null | sed 's/^/   /'
else
    echo "   ❌ Servidor não respondendo em http://localhost:13456"
fi

echo ""
echo "5️⃣ Instruções para acesso:"
echo "   📱 URL: http://localhost:13456"
echo "   🔧 Console: Pressione F12 no navegador"
echo "   📊 Logs: tail -f dashboard.log"

echo ""
echo "6️⃣ Deseja reiniciar o servidor? (s/n)"
read -r resposta
if [[ "$resposta" =~ ^[Ss]$ ]]; then
    echo "   🔄 Reiniciando servidor..."
    pkill -f "node server.js" 2>/dev/null || true
    sleep 2
    cd "$(dirname "$0")"
    > dashboard.log
    PORT=13456 npm start > dashboard.log 2>&1 &
    sleep 3
    if curl -s "http://localhost:13456/api/health" > /dev/null; then
        echo "   ✅ Servidor reiniciado com sucesso!"
        echo "   📱 Acesse: http://localhost:13456"
    else
        echo "   ❌ Falha ao reiniciar servidor"
        echo "   📋 Verifique os logs em: dashboard.log"
    fi
fi
