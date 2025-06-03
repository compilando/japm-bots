#!/bin/bash

echo "🔍 Loki Diagnostic Tool"
echo "======================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if container is running
echo "📦 Checking Loki container status..."
if docker-compose ps loki | grep -q "Up"; then
    echo -e "${GREEN}✅ Loki container is running${NC}"
else
    echo -e "${RED}❌ Loki container is not running${NC}"
    echo "Starting Loki..."
    docker-compose up -d loki
    echo "Waiting 30 seconds for Loki to start..."
    sleep 30
fi

echo ""

# Check health endpoint
echo "🏥 Checking health endpoints..."
health_response=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:3100/ready 2>/dev/null)
if [ "$health_response" = "200" ]; then
    echo -e "${GREEN}✅ /ready endpoint: OK ($health_response)${NC}"
else
    echo -e "${RED}❌ /ready endpoint: FAILED ($health_response)${NC}"
fi

metrics_response=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:3100/metrics 2>/dev/null)
if [ "$metrics_response" = "200" ]; then
    echo -e "${GREEN}✅ /metrics endpoint: OK ($metrics_response)${NC}"
else
    echo -e "${RED}❌ /metrics endpoint: FAILED ($metrics_response)${NC}"
fi

echo ""

# Check API endpoints
echo "🔌 Checking API endpoints..."
labels_response=$(curl -s -w "%{http_code}" -o /dev/null "http://localhost:3100/loki/api/v1/labels" 2>/dev/null)
if [ "$labels_response" = "200" ]; then
    echo -e "${GREEN}✅ /loki/api/v1/labels: OK ($labels_response)${NC}"
else
    echo -e "${RED}❌ /loki/api/v1/labels: FAILED ($labels_response)${NC}"
fi

echo ""

# Check logs and configuration
echo "📋 Recent Loki logs (last 20 lines):"
echo "=================================="
docker-compose logs --tail=20 loki

echo ""

# Check if Promtail is sending logs
echo "📤 Checking Promtail connection..."
promtail_logs=$(docker-compose logs --tail=10 promtail 2>/dev/null | grep -i "error\|fail" | wc -l)
if [ "$promtail_logs" -eq 0 ]; then
    echo -e "${GREEN}✅ Promtail appears to be working (no recent errors)${NC}"
else
    echo -e "${YELLOW}⚠️  Promtail has some errors. Recent logs:${NC}"
    docker-compose logs --tail=5 promtail | grep -i "error\|fail"
fi

echo ""

# Check disk space for Loki data
echo "💾 Checking disk usage..."
loki_data_size=$(docker exec $(docker-compose ps -q loki) du -sh /tmp/loki 2>/dev/null | cut -f1)
if [ -n "$loki_data_size" ]; then
    echo -e "${GREEN}✅ Loki data directory size: $loki_data_size${NC}"
else
    echo -e "${YELLOW}⚠️  Could not determine Loki data size${NC}"
fi

echo ""

# Test a simple query
echo "🔍 Testing log query..."
query_test=$(curl -s "http://localhost:3100/loki/api/v1/query?query=%7Bjob%3D%22docker-containers%22%7D" 2>/dev/null)
if echo "$query_test" | grep -q "status"; then
    echo -e "${GREEN}✅ Query API is responding${NC}"
    log_count=$(echo "$query_test" | grep -o '"values":\[\[' | wc -l)
    echo "📊 Query returned $log_count log streams"
else
    echo -e "${RED}❌ Query API is not responding correctly${NC}"
    echo "Response: $query_test"
fi

echo ""

# Recommendations
echo "💡 Recommendations:"
echo "=================="
if [ "$health_response" != "200" ]; then
    echo "- Restart the Loki container: docker-compose restart loki"
fi
if [ "$labels_response" != "200" ]; then
    echo "- Check Loki configuration in loki/local-config.yaml"
fi
if [ "$promtail_logs" -gt 0 ]; then
    echo "- Check Promtail configuration in promtail/config.yml"
fi

echo ""
echo "🌐 Useful URLs:"
echo "- Loki health: http://localhost:3100/ready"
echo "- Loki metrics: http://localhost:3100/metrics"
echo "- Loki labels: http://localhost:3100/loki/api/v1/labels"
echo "- Grafana logs: http://localhost:3001/explore (select Loki datasource)"

echo ""
echo "🔧 Quick fixes to try:"
echo "- docker-compose restart loki"
echo "- docker-compose restart promtail"
echo "- docker-compose down && docker-compose up -d (full restart)" 