#!/bin/bash

echo "🚀 GENERANDO LOGS MASIVOS PARA GRAFANA"
echo "====================================="
echo ""

echo "🎯 Enviando 50 requests distribuidos en 3 tipos de bots..."
echo ""

for i in {1..50}; do
    # Alternar entre tipos de bots
    if [ $((i % 3)) -eq 0 ]; then
        bot_type="python"
        emoji="🐍"
    elif [ $((i % 3)) -eq 1 ]; then
        bot_type="node"
        emoji="🟢"
    else
        bot_type="java"
        emoji="☕"
    fi
    
    echo "$emoji Request $i/50 ($bot_type)..."
    
    # Invocar bot
    curl -s -X POST http://localhost:3000/invoke \
        -H "Content-Type: application/json" \
        -d "{
            \"botType\":\"$bot_type\",
            \"payload\":{
                \"test\":\"log-generation-$i\",
                \"batch\":\"massive-logs\",
                \"timestamp\":\"$(date)\",
                \"sequence\":$i
            },
            \"webhookUrl\":\"http://mock-webhook:5000\"
        }" > /dev/null
    
    # Pequeña pausa para no saturar
    sleep 0.5
done

echo ""
echo "✅ ¡50 requests enviados!"
echo ""
echo "🔍 Esperando 30 segundos para que se procesen todos los logs..."
sleep 30

echo ""
echo "📊 Verificando logs generados:"

# Verificar logs de la última hora
current_time=$(date +%s)
start_time=$((current_time - 3600))

# Query a Loki
total_logs=$(curl -s "http://localhost:3100/loki/api/v1/query_range?query=%7Bjob%3D%22docker-logs-direct%22%7D&start=${start_time}000000000&end=${current_time}000000000&limit=100" | jq -r '.data.result | length' 2>/dev/null)

if [ "$total_logs" -gt 0 ]; then
    echo "✅ $total_logs streams de logs disponibles"
    echo ""
    echo "🎯 AHORA VE A GRAFANA:"
    echo "   1. http://localhost:3001/explore"
    echo "   2. Query: {job=\"docker-logs-direct\"}"
    echo "   3. Time: Last 1 hour"
    echo "   4. Run query"
    echo ""
    echo "📊 Dashboard: http://localhost:3001/d/bot-logs/bot-system-logs"
else
    echo "❌ No se detectaron logs. Hay un problema con la configuración."
fi

echo ""
echo "🔧 URLs útiles:"
echo "   📊 Grafana Dashboard: http://localhost:3001/d/bot-logs/bot-system-logs"
echo "   🔍 Grafana Explore:   http://localhost:3001/explore"
echo "   📈 API Gateway:       http://localhost:3000"
echo "   🔄 Bull Board:        http://localhost:3000/admin/queues" 