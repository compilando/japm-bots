# Bot System Scripts

## 🚀 start.sh - Sistema Inicializador
Inicia todo el sistema con stack de logging completo.

### Uso:
```bash
./scripts/start.sh              # Inicio normal
./scripts/start.sh --clean      # Limpieza y rebuild
./scripts/start.sh --force      # Limpieza completa + rebuild
./scripts/start.sh --help       # Ver ayuda
```

### Funcionalidades:
- ✅ Inicio de todos los servicios con Docker Compose
- 🧹 Limpieza opcional de imágenes y caché
- 🔨 Build automático de servicios
- ⏳ Espera a que servicios estén listos
- 📊 Muestra URLs de acceso

## 🔍 test.sh - Suite de Pruebas
Prueba todos los endpoints y funcionalidades del sistema.

### Uso:
```bash
./scripts/test.sh               # Ejecutar todas las pruebas
```

### Pruebas incluidas:
- 🏥 Health checks de todos los servicios
- 📊 Endpoints de métricas de Prometheus  
- 🔧 Servicios de monitoreo (Prometheus, Loki, Grafana)
- 🎯 Pruebas funcionales (API Gateway, invocación de bots)
- 📝 Queries de logs en Loki
- 📈 Resumen de resultados

### Resultados:
- Exit code 0: Todas las pruebas pasaron ✅
- Exit code 1: Algunas pruebas fallaron ❌

## 🌐 URLs de Acceso

Después de `./scripts/start.sh`:
- **Grafana:** http://localhost:3001 (admin/admin123)
- **Prometheus:** http://localhost:9090  
- **Loki:** http://localhost:3100
- **Bull Board:** http://localhost:3000/admin/queues
- **API Gateway:** http://localhost:3000
- **Webhook Manager:** http://localhost:4000

## 📋 Dashboards en Grafana
- **Bot System Metrics** - Métricas de rendimiento
- **Bot System Logs** - Logs centralizados de todos los servicios 