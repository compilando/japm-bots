#!/bin/bash

echo "🤖 Quick Start Bot System..."

# Check Docker
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Clean up previous builds if needed
echo "🧹 Cleaning up Docker cache..."
docker system prune -f > /dev/null 2>&1

# Create .env if needed
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp env.example .env
fi

# Build and start
echo "🏗️  Building services..."
docker-compose build --no-cache

echo "🚀 Starting services..."
docker-compose up -d

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 15

# Check status
echo "🔍 Service status:"
docker-compose ps

echo ""
echo "✅ Bot System started!"
echo ""
echo "🌐 Available endpoints:"
echo "   • API Gateway:    http://localhost:3000"
echo "   • Bull Board:     http://localhost:3000/admin/queues"
echo "   • Webhook Manager: http://localhost:4000"
echo "   • Mock Webhook:   http://localhost:5000"
echo "   • Prometheus:     http://localhost:9090"
echo "   • Grafana:        http://localhost:3001 (admin/admin123)" 