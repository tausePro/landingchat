# Guía de Deployment Seguro - Vertical Inmobiliaria

## ⚠️ IMPORTANTE: Estamos en PRODUCCIÓN

Esta feature se desarrolla con extremo cuidado porque el sistema está en producción con clientes activos.

## 🔒 Principios de Seguridad

### 1. **NO DESTRUCTIVO**
- ❌ Nunca usar `DROP TABLE`
- ❌ Nunca usar `ALTER TABLE ... DROP COLUMN`
- ❌ Nunca usar `DELETE` sin WHERE específico
- ❌ Nunca usar `TRUNCATE`
- ✅ Siempre usar `CREATE TABLE IF NOT EXISTS`
- ✅ Siempre usar `ADD COLUMN IF NOT EXISTS`
- ✅ Siempre usar `DROP POLICY IF EXISTS` antes de crear

### 2. **Testing Local Primero**
- ✅ Probar TODA la funcionalidad en local
- ✅ Verificar que no rompe features existentes
- ✅ Probar con datos de prueba
- ✅ Solo después hacer commit y push

### 3. **Rollback Plan**
- ✅ Tag creado: `v1.0.0-pre-real-estate`
- ✅ Para revertir: `git checkout v1.0.0-pre-real-estate`
- ✅ Branch de feature: `feature/real-estate-vertical`

## 📋 Checklist de Deployment

### Fase 1: Preparación (✅ COMPLETADO)
- [x] Crear tag de seguridad en main
- [x] Crear rama feature/real-estate-vertical
- [x] Documentar schema NO destructivo

### Fase 2: Implementación Local (EN PROGRESO)
- [ ] Aplicar migrations en Supabase local
- [ ] Implementar cliente Nuby API
- [ ] Implementar vista de Integraciones
- [ ] Testing local completo

### Fase 3: Testing (PENDIENTE)
- [ ] Probar conexión con Nuby
- [ ] Probar sincronización de propiedades
- [ ] Probar que no afecta features existentes
- [ ] Probar en diferentes navegadores

### Fase 4: Deployment a Producción (PENDIENTE)
- [ ] Commit y push a feature branch
- [ ] Crear Pull Request
- [ ] Review de código
- [ ] Aplicar migrations en Supabase producción
- [ ] Merge a main
- [ ] Monitorear logs

## 🗄️ Orden de Aplicación de Migrations

**IMPORTANTE: Aplicar en este orden exacto**

1. **Extensión de organizations** (bajo impacto)
   ```sql
   ALTER TABLE organizations 
   ADD COLUMN IF NOT EXISTS vertical_config jsonb DEFAULT '{}';
   ```

2. **Tabla integrations** (nueva, sin dependencias)
   ```sql
   CREATE TABLE IF NOT EXISTS integrations (...);
   ```

3. **Tabla properties** (nueva, sin dependencias)
   ```sql
   CREATE TABLE IF NOT EXISTS properties (...);
   ```

4. **Tabla property_appointments** (depende de properties)
   ```sql
   CREATE TABLE IF NOT EXISTS property_appointments (...);
   ```

5. **Tabla integration_sync_logs** (depende de integrations)
   ```sql
   CREATE TABLE IF NOT EXISTS integration_sync_logs (...);
   ```

## 🧪 Testing Local

### Setup Local
```bash
# 1. Asegurar que tienes Supabase local corriendo
supabase status

# 2. Aplicar migrations
supabase db reset # Solo en local!

# 3. Verificar que las tablas se crearon
supabase db diff
```

### Tests a Realizar
1. **Crear integración con Nuby**
   - Guardar credenciales
   - Verificar encriptación
   
2. **Sincronizar propiedades**
   - Sincronización full
   - Sincronización incremental
   - Verificar logs
   
3. **Vista de Integraciones**
   - Conectar Nuby
   - Ver estado de sincronización
   - Desconectar

4. **No Regresión**
   - Verificar que el storefront actual funciona
   - Verificar que el chat funciona
   - Verificar que los agentes funcionan

## 🚨 Plan de Rollback

Si algo sale mal en producción:

### Opción 1: Revertir código
```bash
git checkout main
git revert HEAD~1  # Revertir último commit
git push origin main
```

### Opción 2: Volver al tag
```bash
git checkout v1.0.0-pre-real-estate
git push origin main --force  # ⚠️ Solo en emergencia
```

### Opción 3: Deshabilitar feature
```sql
-- Deshabilitar integraciones sin borrar datos
UPDATE integrations SET status = 'disabled', sync_enabled = false;
```

## 📝 Notas Importantes

1. **Las migraciones SQL NO están en git** (están en .gitignore)
   - Aplicar manualmente en Supabase Dashboard
   - Documentar en este archivo cuando se apliquen

2. **Credenciales encriptadas**
   - Usar `encrypt()` de `src/lib/utils/encryption.ts`
   - Nunca loguear credenciales

3. **RLS habilitado en todas las tablas**
   - Verificar políticas antes de deployment
   - Probar con diferentes usuarios

4. **Monitoreo post-deployment**
   - Revisar logs de Supabase
   - Revisar logs de Vercel
   - Estar atento a errores de usuarios

## 🎯 Estado Actual

**Fecha:** 2025-01-29 11:18 AM  
**Rama:** feature/real-estate-vertical  
**Tag de seguridad:** v1.0.0-pre-real-estate  
**Estado:** Implementación en progreso - NO HACER COMMIT AÚN  

**Archivos creados (solo local):**
- `docs/real-estate-schema.md` - Schema de BD
- `src/lib/nuby/types.ts` - Tipos TypeScript
- `src/lib/nuby/client.ts` - Cliente API
- `src/lib/nuby/mapper.ts` - Mapeo de datos
- `src/lib/nuby/sync.ts` - Sincronización
- `src/app/dashboard/integrations/actions.ts` - Server actions

**Próximos pasos:**
1. Implementar UI de integraciones
2. Testing local completo
3. Solo después: commit y push
