#!/bin/bash

echo "📚 Testing Swagger Documentation Endpoints"
echo "=========================================="
echo ""

# Función para probar endpoint
test_swagger_endpoint() {
    local name=$1
    local url=$2
    
    printf "Testing %-30s" "$name..."
    
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null)
    
    if [ "$status_code" = "200" ] || [ "$status_code" = "301" ]; then
        echo " ✅ OK ($status_code)"
        return 0
    else
        echo " ❌ FAILED ($status_code)"
        return 1
    fi
}

# Función para probar JSON spec
test_swagger_json() {
    local name=$1
    local url=$2
    
    printf "Testing %-30s" "$name JSON..."
    
    local title=$(curl -s --max-time 5 "$url" 2>/dev/null | jq -r '.info.title' 2>/dev/null)
    
    if [ "$title" != "null" ] && [ "$title" != "" ]; then
        echo " ✅ OK ($title)"
        return 0
    else
        echo " ❌ FAILED (Invalid JSON)"
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

echo "=== 📊 API Gateway Swagger ==="
test_swagger_json "API Gateway Spec" "http://localhost:3000/api-docs/swagger.json"; count_test
test_swagger_endpoint "API Gateway UI" "http://localhost:3000/api-docs"; count_test

echo ""
echo "=== 📤 Webhook Manager Swagger ==="
test_swagger_json "Webhook Manager Spec" "http://localhost:4000/api-docs/swagger.json"; count_test
test_swagger_endpoint "Webhook Manager UI" "http://localhost:4000/api-docs"; count_test

echo ""
echo "=== 🔍 API Endpoints Documentation ==="

# Verificar que los endpoints principales estén documentados
echo "Checking documented endpoints..."

api_endpoints=$(curl -s http://localhost:3000/api-docs/swagger.json 2>/dev/null | jq -r '.paths | keys[]' 2>/dev/null | wc -l)
webhook_endpoints=$(curl -s http://localhost:4000/api-docs/swagger.json 2>/dev/null | jq -r '.paths | keys[]' 2>/dev/null | wc -l)

printf "API Gateway endpoints documented: "
if [ "$api_endpoints" -gt 0 ]; then
    echo "✅ $api_endpoints endpoints"
    ((total_tests++))
    ((passed_tests++))
else
    echo "❌ No endpoints found"
    ((total_tests++))
fi

printf "Webhook Manager endpoints documented: "
if [ "$webhook_endpoints" -gt 0 ]; then
    echo "✅ $webhook_endpoints endpoints"
    ((total_tests++))
    ((passed_tests++))
else
    echo "❌ No endpoints found"
    ((total_tests++))
fi

echo ""
echo "=== 📈 Results Summary ==="
echo "Tests passed: $passed_tests/$total_tests"

if [ $passed_tests -eq $total_tests ]; then
    echo "🎉 All Swagger tests passed! Documentation is fully operational."
    exit_code=0
else
    echo "⚠️  Some Swagger tests failed. Check the endpoints above."
    exit_code=1
fi

echo ""
echo "=== 🌐 Swagger Documentation URLs ==="
echo "📊 API Gateway:       http://localhost:3000/api-docs"
echo "📤 Webhook Manager:   http://localhost:4000/api-docs"
echo ""
echo "=== 📋 JSON Specifications ==="
echo "📊 API Gateway JSON:  http://localhost:3000/api-docs/swagger.json"
echo "📤 Webhook Manager JSON: http://localhost:4000/api-docs/swagger.json"

echo ""
echo "=== 🎨 Features Available ==="
echo "✨ Interactive API testing with 'Try it out' buttons"
echo "📝 Comprehensive endpoint documentation"
echo "🔍 Request/response schema validation"
echo "📊 Real-time API exploration"
echo "🎯 Example requests for all bot types"
echo "📤 Webhook delivery examples and tracking"

exit $exit_code 