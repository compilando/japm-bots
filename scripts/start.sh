#!/bin/bash

echo "🤖 Starting Bot System..."

# Verificar que Docker esté corriendo
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Verificar que Docker Compose esté disponible
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed."
    exit 1
fi

# Crear archivo .env si no existe
if [ ! -f .env ]; then
    echo "📝 Creating .env file from env.example..."
    cp env.example .env
fi

# Construir e iniciar servicios
echo "🏗️  Building and starting services..."
docker-compose up --build -d

# Esperar a que los servicios estén listos
echo "⏳ Waiting for services to be ready..."
sleep 30

# Verificar estado de los servicios
echo "🔍 Checking service status..."
docker-compose ps

echo ""
echo "✅ Bot System is ready!"
echo ""
echo "🌐 Available endpoints:"
echo "   • API Gateway:    http://localhost:3000"
echo "   • Bull Board:     http://localhost:3000/admin/queues"
echo "   • Webhook Manager: http://localhost:4000"
echo "   • Mock Webhook:   http://localhost:5000"
echo "   • Prometheus:     http://localhost:9090"
echo "   • Grafana:        http://localhost:3001 (admin/admin123)"
echo ""
echo "📝 Example usage:"
echo "curl -X POST http://localhost:3000/invoke \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"botType\":\"node\",\"payload\":{\"test\":\"hello\"},\"webhookUrl\":\"http://mock-webhook:5000\"}'"
echo ""
echo "📋 View logs: docker-compose logs -f"
echo "🛑 Stop system: docker-compose down" 