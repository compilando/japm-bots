#!/bin/bash

# Función para mostrar ayuda
show_help() {
    echo "🚀 Bot System Starter"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "OPTIONS:"
    echo "  --clean    Clean rebuild (remove all images and containers)"
    echo "  --force    Force rebuild with npm cache cleaning"
    echo "  --help     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0              # Normal start"
    echo "  $0 --clean     # Clean start"
    echo "  $0 --force     # Force clean start"
}

# Función para limpiar todo
clean_all() {
    echo "🧹 Cleaning everything..."
    
    # Stop all containers
    docker compose down
    
    # Remove project images
    echo "🗑️  Removing project images..."
    docker rmi $(docker images | grep japm-bots | awk '{print $3}') 2>/dev/null || true
    
    # Clean build cache
    docker builder prune -f
    
    if [ "$1" = "force" ]; then
        echo "🧼 Force cleaning npm caches..."
        for package in packages/*/; do
            if [ -d "$package" ]; then
                echo "Cleaning $package..."
                (cd "$package" && rm -rf node_modules dist 2>/dev/null || true)
            fi
        done
        
        # Remove dangling images
        docker image prune -f
    fi
}

# Parse arguments
CLEAN=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN=true
            shift
            ;;
        --force)
            CLEAN=true
            FORCE=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

echo "🚀 Starting Bot System with Logging Stack..."
echo ""

# Clean if requested
if [ "$CLEAN" = true ]; then
    if [ "$FORCE" = true ]; then
        clean_all "force"
    else
        clean_all
    fi
fi

# Start services
echo "🔨 Building and starting services..."
docker compose up --build -d

# Wait for services
echo "⏳ Waiting for services to initialize..."
sleep 30

# Show status
echo ""
echo "📊 Service Status:"
docker compose ps

echo ""
echo "✅ Bot System started successfully!"
echo ""
echo "🌐 Access URLs:"
echo "  📊 Prometheus: http://localhost:9090"
echo "  📈 Grafana: http://localhost:3001 (admin/admin123)"
echo "  📝 Loki: http://localhost:3100"
echo "  🔄 Bull Board: http://localhost:3000/admin/queues"
echo "  🚪 API Gateway: http://localhost:3000"
echo "  🔗 Webhook Manager: http://localhost:4000"
echo ""
echo "🔍 Run './scripts/test.sh' to test all endpoints"
echo "📋 Available Dashboards in Grafana:"
echo "  - Bot System Metrics"
echo "  - Bot System Logs" 