# 🔧 Resolución del Problema del Dashboard de Logs

## 🎯 Problema Identificado

El dashboard de Grafana mostraba "No data" en todos los paneles específicos de servicios, aunque el panel "All Container Logs" funcionaba correctamente.

## 🔍 Diagnóstico Realizado

1. **Verificación de servicios**: Todos los contenedores estaban funcionando ✅
2. **Labels en Loki**: Los `service_name` estaban disponibles ✅
3. **Promtail**: Había errores de configuración ❌

## 🐛 Errores Encontrados

### Error Principal en Promtail
```
level=error ts=2025-06-03T19:20:29.257962707Z caller=main.go:169 msg="error creating promtail" 
error="failed to make file target manager: invalid match stage config: match stage requires at least one additional stage to be defined in '- stages'"
```

### Problemas Secundarios
- Queries con timestamps fuera del límite de Loki (30 días)
- Configuración de pipeline stages demasiado compleja
- Stage `match` mal configurado con `action: keep` inválido

## ✅ Soluciones Aplicadas

### 1. Corrección de Configuración de Promtail
```yaml
# ❌ ANTES (problemático)
- match:
    selector: '{project_name="japm-bots"}'
    action: keep  # ← Esto causaba el error

# ✅ DESPUÉS (corregido)
- replace:
    source: service_name
    expression: "^$"
    replace: "unknown_service"
```

### 2. Simplificación del Pipeline
- Eliminado el stage `match` problemático
- Reducidos los labels extraídos a solo los esenciales
- Mejorado el manejo de service_name con fallback

### 3. Configuración Final de Promtail
```yaml
pipeline_stages:
  - json:
      expressions:
        log: log
        stream: stream
        time: time
        attrs: attrs
  - regex:
      source: filename
      expression: "/var/lib/docker/containers/(?P<container_id>[^/]+)/.*"
  - json:
      source: attrs
      expressions:
        service_name: '"com.docker.compose.service"'
  - replace:
      source: service_name
      expression: "^$"
      replace: "unknown_service"
  - output:
      source: log
  - timestamp:
      source: time
      format: RFC3339Nano
  - labels:
      container_id:
      service_name:
      stream:
```

### 4. Reinicios de Servicios
```bash
docker restart japm-bots-promtail-1
docker restart japm-bots-loki-1
docker restart japm-bots-grafana-1
```

## 📊 Estado Actual

- ✅ Promtail: Sin errores de configuración
- ✅ Loki: Respondiendo correctamente
- ✅ Labels: service_name disponibles
- ✅ Dashboard: Debería mostrar logs ahora

## 🔗 Enlaces de Verificación

- **Dashboard**: http://localhost:3001/d/bot-logs/bot-system-logs
- **Credenciales**: admin/admin123
- **Loki API**: http://localhost:3100

## 🧪 Próximos Pasos

1. Verificar el dashboard en http://localhost:3001
2. Si persisten problemas, esperar 5-10 minutos para propagación
3. Generar más actividad si es necesario:
   ```bash
   curl "http://localhost:3000/health"
   ```

## 📝 Lecciones Aprendidas

- Los stages `match` en Promtail requieren stages adicionales, no `action: keep`
- Loki tiene límites de tiempo en queries (30 días máximo)
- Simplificar la configuración mejora la robustez
- Los reinicios son necesarios para aplicar cambios de configuración 