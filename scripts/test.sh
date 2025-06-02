#!/bin/bash

echo "🧪 Testing Bot System..."

# Función para hacer requests
make_request() {
    local bot_type=$1
    local test_id=$2
    
    echo "📤 Testing $bot_type bot (test $test_id)..."
    
    response=$(curl -s -X POST http://localhost:3000/invoke \
        -H "Content-Type: application/json" \
        -d "{
            \"botType\": \"$bot_type\",
            \"payload\": {
                \"test_id\": $test_id,
                \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
                \"data\": \"test_data_$test_id\"
            },
            \"webhookUrl\": \"http://mock-webhook:5000\",
            \"priority\": $((RANDOM % 5 + 1))
        }")
    
    job_id=$(echo $response | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)
    echo "✅ Job created: $job_id"
}

# Verificar que el sistema esté corriendo
echo "🔍 Checking if system is running..."
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo "❌ System is not running. Please start it first with: ./scripts/start.sh"
    exit 1
fi

echo "✅ System is running!"
echo ""

# Test básico de cada tipo de bot
echo "🚀 Running basic tests..."
make_request "python" 1
make_request "node" 2
make_request "java" 3

echo ""
echo "⏳ Waiting for jobs to process..."
sleep 10

# Test de carga
echo "🔥 Running load test (10 concurrent requests)..."
for i in {1..10}; do
    bot_types=("python" "node" "java")
    bot_type=${bot_types[$((RANDOM % 3))]}
    make_request $bot_type $i &
done

wait

echo ""
echo "⏳ Waiting for load test to complete..."
sleep 15

# Verificar estadísticas
echo "📊 Checking statistics..."
echo ""
echo "API Gateway Stats:"
curl -s http://localhost:3000/stats | jq '.'

echo ""
echo "Mock Webhook Stats:"
curl -s http://localhost:5000/stats | jq '.'

echo ""
echo "Recent Webhooks:"
curl -s http://localhost:5000/webhooks?limit=5 | jq '.webhooks[] | {id, timestamp, botType: .body.botType, success: .body.success}'

echo ""
echo "✅ Testing completed!"
echo ""
echo "🌐 View more details at:"
echo "   • Bull Board: http://localhost:3000/admin/queues"
echo "   • Grafana:    http://localhost:3001"
echo "   • Prometheus: http://localhost:9090" 