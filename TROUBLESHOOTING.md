# Troubleshooting Guide

## Common Issues and Solutions

### Docker Build Issues

#### 1. "failed to compute cache key" Error

**Problem**: Docker can't find source files during build.

**Solution**:
```bash
# Clean Docker cache
docker system prune -f

# Rebuild without cache
docker-compose build --no-cache

# Or build individual service
docker-compose build --no-cache api-gateway
```

#### 2. "failed to set up container networking" Error

**Problem**: Docker networking issues, often related to iptables or firewall.

**Solutions**:

**Option A - Restart Docker**:
```bash
sudo systemctl restart docker
```

**Option B - Reset Docker Networks**:
```bash
docker network prune -f
docker-compose down
docker-compose up
```

**Option C - Use Host Networking (temporary)**:
Add to docker-compose.yml:
```yaml
services:
  service-name:
    network_mode: host
```

**Option D - Check Firewall**:
```bash
# On Ubuntu/Debian
sudo ufw status
sudo ufw allow 6379  # Redis
sudo ufw allow 3000  # API Gateway
sudo ufw allow 4000  # Webhook Manager
sudo ufw allow 5000  # Mock Webhook

# On Arch Linux
sudo iptables -L
```

### Service Startup Issues

#### 1. Services Not Starting

**Check logs**:
```bash
docker-compose logs -f
docker-compose logs service-name
```

**Common fixes**:
```bash
# Restart specific service
docker-compose restart service-name

# Rebuild and restart
docker-compose up --build service-name

# Check service health
docker-compose ps
```

#### 2. Redis Connection Issues

**Check Redis**:
```bash
# Test Redis connection
docker-compose exec redis redis-cli ping

# Check Redis logs
docker-compose logs redis
```

**Fix Redis issues**:
```bash
# Restart Redis
docker-compose restart redis

# Reset Redis data
docker-compose down
docker volume rm japm-bots_redis-data
docker-compose up redis
```

### Build Performance Issues

#### 1. Slow Builds

**Use simplified compose file**:
```bash
# Test with minimal services
docker-compose -f docker-compose.simple.yml up
```

**Optimize builds**:
```bash
# Use Docker BuildKit
export DOCKER_BUILDKIT=1
docker-compose build

# Or use Compose Bake
export COMPOSE_BAKE=true
docker-compose build
```

#### 2. Out of Disk Space

**Clean Docker**:
```bash
# Remove unused containers, networks, images
docker system prune -a

# Remove specific volumes
docker volume ls
docker volume rm volume-name

# Check disk usage
docker system df
```

### Development Issues

#### 1. TypeScript Compilation Errors

**Check individual packages**:
```bash
cd packages/common
npm install
npm run build

cd ../api-gateway
npm install
npm run build
```

**Fix dependency issues**:
```bash
# Clean node_modules
find . -name "node_modules" -type d -exec rm -rf {} +

# Reinstall dependencies
cd packages/common && npm ci
cd ../api-gateway && npm ci
# ... repeat for other packages
```

#### 2. Port Conflicts

**Check what's using ports**:
```bash
# Linux
sudo netstat -tulpn | grep :3000
sudo lsof -i :3000

# Kill process using port
sudo kill -9 $(sudo lsof -t -i:3000)
```

**Change ports in docker-compose.yml**:
```yaml
services:
  api-gateway:
    ports:
      - "3001:3000"  # Use different external port
```

### Testing Issues

#### 1. Services Not Responding

**Test connectivity**:
```bash
# Test API Gateway
curl http://localhost:3000/health

# Test Mock Webhook
curl http://localhost:5000/health

# Test from inside container
docker-compose exec api-gateway curl http://mock-webhook:5000/health
```

#### 2. Load Test Failures

**Check resource limits**:
```bash
# Monitor resources
docker stats

# Check system resources
htop
free -h
df -h
```

**Reduce load**:
```bash
# Use fewer concurrent requests in test script
# Increase timeouts
# Scale down worker replicas
```

### Quick Fixes

#### 1. Complete Reset

```bash
# Stop everything
docker-compose down -v

# Clean Docker
docker system prune -a -f

# Remove project containers and images
docker images | grep japm-bots | awk '{print $3}' | xargs docker rmi -f

# Start fresh
docker-compose up --build
```

#### 2. Minimal Test Setup

```bash
# Test with just essential services
docker-compose up redis mock-webhook

# Test individual service
docker-compose up --build api-gateway
```

#### 3. Debug Mode

```bash
# Run in foreground to see logs
docker-compose up

# Run specific service with debug
docker-compose run --rm api-gateway npm run dev
```

### Environment Issues

#### 1. Missing Environment Variables

**Check .env file**:
```bash
# Copy example
cp env.example .env

# Edit as needed
nano .env
```

#### 2. Permission Issues

**Fix file permissions**:
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Fix ownership (if needed)
sudo chown -R $USER:$USER .
```

### Getting Help

If none of these solutions work:

1. **Check Docker version**: `docker --version` (requires 20.10+)
2. **Check Docker Compose version**: `docker-compose --version` (requires 2.0+)
3. **Check system resources**: Ensure sufficient RAM (4GB+) and disk space (10GB+)
4. **Check logs**: Always include relevant logs when asking for help
5. **Minimal reproduction**: Try with `docker-compose.simple.yml`

### Useful Commands

```bash
# View all containers
docker ps -a

# View all images
docker images

# View all volumes
docker volume ls

# View all networks
docker network ls

# Clean everything
docker system prune -a --volumes

# Monitor resources
docker stats

# Follow logs
docker-compose logs -f --tail=100
``` 