#!/bin/bash
# =====================================================
# Script de Backup de Base de Datos Supabase
# =====================================================
# Uso: ./scripts/backup-database.sh
# 
# Requisitos:
# - pg_dump instalado (viene con PostgreSQL)
# - Variables de entorno configuradas en .env.local
# =====================================================

# Cargar variables de entorno
source .env.local

# Configuración
BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/landingchat_backup_${TIMESTAMP}.sql"

# Crear directorio de backups si no existe
mkdir -p $BACKUP_DIR

# Extraer datos de conexión de SUPABASE_URL
# Formato: https://[PROJECT_REF].supabase.co
PROJECT_REF=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed 's/https:\/\/\([^.]*\).*/\1/')
DB_HOST="${PROJECT_REF}.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"

echo "🔄 Iniciando backup de base de datos..."
echo "📁 Archivo: $BACKUP_FILE"

# Configurar contraseña desde variable de entorno
# Obtener contraseña del connection string de Supabase
# Si no está configurada, el script pedirá la contraseña manualmente
export PGPASSWORD="${SUPABASE_DB_PASSWORD:-}"

# Ejecutar pg_dump
pg_dump \
  --host=$DB_HOST \
  --port=$DB_PORT \
  --username=$DB_USER \
  --dbname=$DB_NAME \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --file=$BACKUP_FILE

if [ $? -eq 0 ]; then
    echo "✅ Backup completado exitosamente"
    echo "📊 Tamaño: $(du -h $BACKUP_FILE | cut -f1)"
    
    # Comprimir backup
    gzip $BACKUP_FILE
    echo "🗜️  Comprimido: ${BACKUP_FILE}.gz"
    
    # Limpiar backups antiguos (mantener últimos 7)
    echo "🧹 Limpiando backups antiguos..."
    ls -t ${BACKUP_DIR}/landingchat_backup_*.sql.gz | tail -n +8 | xargs rm -f 2>/dev/null
    
    echo "✨ Proceso completado"
else
    echo "❌ Error al crear backup"
    exit 1
fi
