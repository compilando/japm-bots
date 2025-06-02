#!/bin/bash

echo "🔍 Testing Bot System - All Endpoints & Functionality"
echo ""

# Función para probar endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    printf "Testing %-25s" "$name..."
    
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo " ✅ OK ($status_code)"
        return 0
    else
        echo " ❌ FAILED ($status_code)"
        return 1
    fi
}

# Función para probar con JSON payload
test_post_endpoint() {
    local name=$1
    local url=$2
    local payload=$3
    local expected_status=${4:-200}
    
    printf "Testing %-25s" "$name..."
    
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$url" 2>/dev/null)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo " ✅ OK ($status_code)"
        return 0
    else
        echo " ❌ FAILED ($status_code)"
        return 1
    fi
}

# Contadores
total_tests=0
passed_tests=0

# Función para incrementar contadores
count_test() {
    total_tests=$((total_tests + 1))
    if [ $? -eq 0 ]; then
        passed_tests=$((passed_tests + 1))
    fi
}

echo "=== 🏥 Health Checks ==="
test_endpoint "API Gateway" "http://localhost:3000/health"; count_test
test_endpoint "Orchestrator" "http://localhost:3002/health"; count_test
test_endpoint "Webhook Manager" "http://localhost:4000/health"; count_test
test_endpoint "Workers-1" "http://localhost:3003/health"; count_test
test_endpoint "Workers-2" "http://localhost:3004/health"; count_test
test_endpoint "Workers-3" "http://localhost:3005/health"; count_test
test_endpoint "Mock Webhook" "http://localhost:5000/health"; count_test

echo ""
echo "=== 📊 Metrics Endpoints ==="
test_endpoint "API Gateway Metrics" "http://localhost:3000/metrics"; count_test
test_endpoint "Orchestrator Metrics" "http://localhost:3002/metrics"; count_test
test_endpoint "Webhook Manager Metrics" "http://localhost:4000/metrics"; count_test
test_endpoint "Workers-1 Metrics" "http://localhost:3003/metrics"; count_test
test_endpoint "Workers-2 Metrics" "http://localhost:3004/metrics"; count_test
test_endpoint "Workers-3 Metrics" "http://localhost:3005/metrics"; count_test

echo ""
echo "=== 🔧 Monitoring Services ==="
test_endpoint "Prometheus" "http://localhost:9090/-/healthy"; count_test
test_endpoint "Loki" "http://localhost:3100/ready"; count_test
test_endpoint "Grafana" "http://localhost:3001/api/health"; count_test

echo ""
echo "=== 🎯 Functional Tests ==="

# Test API Gateway invoke endpoints
bot_payload='{"botType":"node","payload":{"test":"automated-test"},"webhookUrl":"http://mock-webhook:5000"}'
test_post_endpoint "Bot Invocation" "http://localhost:3000/invoke" "$bot_payload"; count_test

# Test stats endpoints
test_endpoint "API Gateway Stats" "http://localhost:3000/stats"; count_test
test_endpoint "Webhook Manager Stats" "http://localhost:4000/stats"; count_test

# Test Bull Board
test_endpoint "Bull Board" "http://localhost:3000/admin/queues"; count_test

echo ""
echo "=== 📝 Log Queries Test ==="

# Test Loki query API
printf "Testing %-25s" "Loki Query API..."
loki_response=$(curl -s --max-time 5 "http://localhost:3100/loki/api/v1/query?query={container_name=~\".%2B\"}" 2>/dev/null)
if echo "$loki_response" | grep -q "status.*success"; then
    echo " ✅ OK (logs available)"
    ((total_tests++))
    ((passed_tests++))
else
    echo " ❌ FAILED (no logs or error)"
    ((total_tests++))
fi

echo ""
echo "=== 📈 Results Summary ==="
echo "Tests passed: $passed_tests/$total_tests"

if [ $passed_tests -eq $total_tests ]; then
    echo "🎉 All tests passed! System is fully operational."
    exit_code=0
else
    echo "⚠️  Some tests failed. Check the services above."
    exit_code=1
fi

echo ""
echo "=== 🌐 Quick Access URLs ==="
echo "📊 Prometheus:    http://localhost:9090"
echo "📈 Grafana:       http://localhost:3001 (admin/admin123)"
echo "📝 Loki:          http://localhost:3100"
echo "🔄 Bull Board:    http://localhost:3000/admin/queues"
echo "🚪 API Gateway:   http://localhost:3000"
echo "🔗 Webhook Mgr:   http://localhost:4000"

echo ""
echo "=== 🎨 Useful Log Queries for Grafana ==="
echo "All logs:         {container_name=~\".+\"}"
echo "Errors only:      {container_name=~\".+\"} |~ \"(?i)(error|exception|fail)\""
echo "Bot executions:   {container_name=~\".+\"} |~ \"🤖.*bot\""
echo "Webhook delivery: {container_name=~\".+\"} |~ \"📤.*webhook\""
echo "Success ops:      {container_name=~\".+\"} |~ \"✅\""
echo "Failed ops:       {container_name=~\".+\"} |~ \"❌\""

echo ""
echo "=== 📋 Example API Usage ==="
echo "# Invoke a Node.js bot:"
echo "curl -X POST http://localhost:3000/invoke \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"botType\":\"node\",\"payload\":{\"test\":\"hello\"},\"webhookUrl\":\"http://mock-webhook:5000\"}'"

exit $exit_code 