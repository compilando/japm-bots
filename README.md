# 🤖 Bot System - Distributed Bot Execution Platform

Complete multi-language bot execution system with TypeScript, Redis, BullMQ and real-time monitoring.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │────│  Orchestrator   │────│    Workers      │
│   (Express)     │    │  (Semaphores)   │    │ (Python/Node/   │
│                 │    │                 │    │     Java)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
         │ Webhook Manager │    │     Redis       │    │ Mock Webhook    │
         │   (Retries)     │    │   (Queues)      │    │   (Testing)     │
         └─────────────────┘    └─────────────────┘    └─────────────────┘
                                         │
         ┌─────────────────┐    ┌─────────────────┐
         │   Prometheus    │    │    Grafana      │
         │   (Metrics)     │    │  (Dashboard)    │
         └─────────────────┘    └─────────────────┘
```

## 🚀 Features

- **Concurrency Control**: Distributed semaphores per bot type
- **Asynchronous Execution**: Specialized workers for Python, Node.js and Java
- **Smart Retries**: Exponential backoff for webhooks
- **Complete Monitoring**: Prometheus metrics and Grafana dashboards
- **High Availability**: Graceful shutdown and failure recovery
- **Scalability**: Multiple workers and replicas
- **📚 Interactive API Documentation**: Swagger UI for both API Gateway and Webhook Manager

## 📦 Services

### API Gateway (Port 3000)
- Main endpoint for bot invocation
- Interactive Swagger documentation
- Bull Board for queue monitoring
- Prometheus metrics
- Rate limiting and security

### Orchestrator
- Distributed semaphore management
- Delegation to specific workers
- Progress monitoring
- Automatic job cleanup

### Workers
- Python, Node.js and Java bot simulators
- Different execution times
- Automatic result sending
- Error handling

### Webhook Manager (Port 4000)
- Webhook delivery with retries
- Exponential backoff
- Delivery metrics
- Temporary/permanent error handling

### Mock Webhook (Port 5000)
- Testing webhook server
- Error simulation
- Delivery statistics
- Testing endpoints

## 🛠️ Installation and Usage

### Prerequisites
- Docker and Docker Compose
- Git

### Quick Start

1. **Clone repository**
```bash
git clone <repository-url>
cd japm-bots
```

2. **Start the system**
```bash
./scripts/start.sh
```

3. **Test all services**
```bash
./scripts/test.sh
```

### Available Scripts

- `./scripts/start.sh` - Start complete system with logging
- `./scripts/start.sh --clean` - Clean rebuild
- `./scripts/start.sh --force` - Force clean rebuild  
- `./scripts/test.sh` - Test all endpoints and functionality
- `./scripts/test-swagger.sh` - Test Swagger documentation endpoints

### Main Endpoints

- **API Gateway**: http://localhost:3000
  - **📚 API Documentation**: http://localhost:3000/api-docs
- **Bull Board**: http://localhost:3000/admin/queues
- **Webhook Manager**: http://localhost:4000
  - **📚 API Documentation**: http://localhost:4000/api-docs
- **Mock Webhook**: http://localhost:5000
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin123)
- **Loki**: http://localhost:3100

## 📚 Interactive API Documentation

Both services now include comprehensive Swagger documentation:

### 🤖 API Gateway Documentation
- **URL**: http://localhost:3000/api-docs
- **Features**:
  - Interactive bot invocation with examples
  - Real-time job status monitoring
  - Queue statistics and health checks
  - Try-it-out functionality for all endpoints

### 📤 Webhook Manager Documentation  
- **URL**: http://localhost:4000/api-docs
- **Features**:
  - Webhook delivery management
  - Delivery status tracking
  - Retry configuration examples
  - Comprehensive error handling documentation

### 🎯 Key Documentation Features
- **Interactive Testing**: Use "Try it out" buttons to test APIs directly
- **Schema Validation**: Real-time request/response validation
- **Multiple Examples**: Python, Node.js, and Java bot examples
- **Error Scenarios**: Comprehensive error response documentation
- **Authentication**: Ready for future auth implementation

## 📝 Usage Examples

### Invoke a Python Bot
```bash
curl -X POST http://localhost:3000/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "botType": "python",
    "payload": {"task": "data_analysis", "dataset": "sales_2024"},
    "webhookUrl": "http://mock-webhook:5000",
    "priority": 1
  }'
```

### Invoke a Node.js Bot
```bash
curl -X POST http://localhost:3000/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "botType": "node",
    "payload": {"action": "process_api", "endpoint": "/users"},
    "webhookUrl": "http://mock-webhook:5000",
    "priority": 2
  }'
```

### Invoke a Java Bot
```bash
curl -X POST http://localhost:3000/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "botType": "java",
    "payload": {"operation": "batch_process", "records": 1000},
    "webhookUrl": "http://mock-webhook:5000",
    "priority": 3
  }'
```

### Check Job Status
```bash
curl http://localhost:3000/job/{jobId}
```

### View Statistics
```bash
curl http://localhost:3000/stats
curl http://localhost:5000/stats
```

## 📊 Monitoring

### Available Metrics

- `bot_executions_total`: Total executions by type and status
- `bot_execution_duration_seconds`: Execution duration
- `webhook_deliveries_total`: Total webhook deliveries
- `webhook_delivery_duration_seconds`: Delivery duration
- `queue_size`: Current queue size
- `semaphore_usage`: Current semaphore usage
- `semaphore_waiting`: Tasks waiting for semaphores

### Grafana Dashboards

Access http://localhost:3001 with:
- Username: `admin`
- Password: `admin123`

**Bot System Metrics Dashboard**:
- Total bot executions
- Execution rate by type
- Execution duration (percentiles)
- Webhook delivery status
- Real-time queue size
- Semaphore usage

**Bot System Logs Dashboard**:
- Real-time logs from all services
- Service-specific log panels
- Error filtering and search
- Log rate metrics

### Useful Log Queries
```bash
# All logs
{container_name=~".+"}

# Errors only
{container_name=~".+"} |~ "(?i)(error|exception|fail)"

# Bot executions
{container_name=~".+"} |~ "🤖.*bot"

# Webhook deliveries
{container_name=~".+"} |~ "📤.*webhook"
```

## 🔧 Configuration

### Environment Variables

Copy `env.example` to `.env` and adjust:

```bash
# Bot configuration
MAX_PYTHON_BOTS=5
MAX_NODE_BOTS=10
MAX_JAVA_BOTS=3

# Webhook configuration
WEBHOOK_MAX_RETRIES=5
WEBHOOK_RETRY_DELAY=1000

# Ports
API_GATEWAY_PORT=3000
WEBHOOK_MANAGER_PORT=4000
MOCK_WEBHOOK_PORT=5000
```

### Scaling

To scale workers:
```bash
docker-compose up --scale workers=5 -d
```

## 🧪 Testing

### Load Testing
```bash
# Send multiple requests
for i in {1..10}; do
  curl -X POST http://localhost:3000/invoke \
    -H "Content-Type: application/json" \
    -d "{\"botType\":\"node\",\"payload\":{\"test\":$i},\"webhookUrl\":\"http://mock-webhook:5000\"}" &
done
```

### Webhook Testing
```bash
# Success test
curl -X POST http://localhost:5000/test/success

# Error test
curl -X POST http://localhost:5000/test/error

# Timeout test
curl -X POST http://localhost:5000/test/timeout
```

## 📋 Logs

View service logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api-gateway
docker-compose logs -f orchestrator
docker-compose logs -f workers
docker-compose logs -f webhook-manager
```

## 🛑 System Shutdown

```bash
# Graceful shutdown
docker-compose down

# Shutdown with volume cleanup
docker-compose down -v
```

## 🔍 Troubleshooting

### Quick Fixes

**Docker networking issues**:
```bash
sudo systemctl restart docker
docker network prune -f
```

**Build cache issues**:
```bash
docker system prune -f
docker-compose build --no-cache
```

**Complete reset**:
```bash
docker-compose down -v
docker system prune -a -f
docker-compose up --build
```

### Common Issues

1. **Port occupied**: Change ports in `docker-compose.yml`
2. **Insufficient memory**: Reduce worker replicas
3. **Redis connection issues**: Check Redis health check
4. **Build failures**: See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
5. **Loki 503 errors**: 
   - Wait 30 seconds after startup for full initialization
   - Run `./scripts/loki-diagnose.sh` for detailed diagnosis
   - Restart with `docker-compose restart loki promtail`

### Status Verification
```bash
# Container status
docker-compose ps

# Error logs
docker-compose logs --tail=50

# Resource usage
docker stats

# Test minimal setup
docker-compose -f docker-compose.simple.yml up

# Loki-specific diagnostics
./scripts/loki-diagnose.sh
```

For detailed troubleshooting, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## 🤝 Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -am 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Create Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [BullMQ](https://bullmq.io/) - Robust queue system
- [Prometheus](https://prometheus.io/) - Monitoring and alerting
- [Grafana](https://grafana.com/) - Metrics visualization
- [Redis](https://redis.io/) - In-memory database 