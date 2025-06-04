# 🔧 Configuración Persistente del Dashboard de Logs

## 📋 Resumen

Se ha configurado el dashboard de Grafana para que **sobreviva a reinicios** usando `service_name` en lugar de `container_id` que cambia con cada reinicio.

## 🎯 Problema Resuelto

**ANTES**: Dashboard se rompía después de reiniciar contenedores
- Usaba `container_id` que cambia en cada reinicio
- Requería actualización manual del dashboard
- No era escalable ni mantenible

**AHORA**: Dashboard persistente y robusto
- Usa `service_name` de Docker Compose
- Funciona automáticamente después de reinicios
- No requiere intervención manual

## 🔧 Configuración Técnica

### 1. Promtail Configuration (`promtail/config.yml`)

```yaml
# Configuración robusta para logs directos de archivos
- job_name: docker-logs-direct
  static_configs:
    - targets:
        - localhost
      labels:
        job: docker-logs-direct
        __path__: /var/lib/docker/containers/*/*-json.log

  pipeline_stages:
    # Parse JSON log format de Docker
    - json:
        expressions:
          log: log
          stream: stream
          time: time
          attrs: attrs

    # Extract container info from file path
    - regex:
        source: filename
        expression: "/var/lib/docker/containers/(?P<container_id>[^/]+)/.*"

    # Extract service info from attrs (Docker labels)
    - json:
        source: attrs
        expressions:
          container_name: '["com.docker.compose.container-number"]'
          service_name: '["com.docker.compose.service"]'
          project_name: '["com.docker.compose.project"]'

    # Use log content as message
    - output:
        source: log

    # Parse timestamp
    - timestamp:
        source: time
        format: RFC3339Nano

    # Add labels persistentes
    - labels:
        container_id:
        service_name:
        project_name:
        stream:
```

### 2. Dashboard Queries (`grafana/dashboards/logs-dashboard.json`)

| Panel | Query | Descripción |
|-------|--------|-------------|
| 🚀 API Gateway | `{job="docker-logs-direct", service_name="api-gateway"}` | Logs del gateway principal |
| 👷 Workers | `{job="docker-logs-direct", service_name=~"workers-(1\|2\|3)"}` | Logs de todos los workers |
| 📤 Webhook Manager | `{job="docker-logs-direct", service_name="webhook-manager"}` | Logs del gestor de webhooks |
| 🎯 Orchestrator | `{job="docker-logs-direct", service_name="orchestrator"}` | Logs del orquestador |
| 🗄️ Redis | `{job="docker-logs-direct", service_name="redis"}` | Logs de Redis |
| 🔗 Mock Webhook | `{job="docker-logs-direct", service_name="mock-webhook"}` | Logs del webhook de prueba |
| 📊 Infrastructure | `{job="docker-logs-direct", service_name=~"(grafana\|loki\|prometheus\|promtail)"}` | Logs de infraestructura |

## ✅ Beneficios de la Nueva Configuración

### 🔄 Persistencia
- **Reinicios automáticos**: `docker-compose restart` no afecta el dashboard
- **Recreación de contenedores**: `docker-compose up --force-recreate` funciona
- **Actualizaciones**: Cambios en imágenes mantienen el dashboard

### 🎯 Mantenibilidad
- **Sin intervención manual**: No requiere actualizar IDs
- **Escalabilidad**: Agregar nuevos servicios es simple
- **Configuración centralizada**: Todo en archivos de configuración

### 🚀 Robustez
- **Basado en service names**: Nombres estables de Docker Compose
- **Labels automáticos**: Extraídos directamente de metadatos
- **Fallback robusto**: Funciona aunque algunos servicios fallen

## 🧪 Scripts de Verificación

### `scripts/verify-persistent-dashboard.sh`
- Verifica configuración persistente
- Prueba queries por service_name
- Genera logs de prueba

### `scripts/test-restart-persistence.sh`
- Prueba reinicio completo del sistema
- Verifica funcionalidad post-reinicio
- Valida persistencia real

## 📊 URLs del Dashboard

- **Dashboard principal**: http://localhost:3001/d/bot-logs/bot-system-logs
- **Grafana Explore**: http://localhost:3001/explore
- **Credenciales**: admin / admin123

## 🔧 Configuración del Dashboard

### Configuración Recomendada:
- **Time Range**: Last 15 minutes
- **Auto-refresh**: 5s (ya configurado)
- **Refresh manual**: Disponible

### Troubleshooting:
1. **Panel vacío**: Verificar rango de tiempo
2. **Sin logs**: Generar actividad con `./scripts/generate-logs.sh`
3. **Después de reinicio**: Esperar 30 segundos y hacer refresh

## 🎉 Resultado Final

Dashboard completamente funcional que:
- ✅ Muestra logs de todos los servicios
- ✅ Sobrevive a reinicios automáticamente
- ✅ No requiere mantenimiento manual
- ✅ Es escalable y robusto
- ✅ Usa queries persistentes basadas en service_name

**¡El dashboard ahora es verdaderamente persistente!** 🚀 