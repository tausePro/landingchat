#!/bin/bash
# =====================================================
# Backup SOLO de datos (sin schema)
# Útil para restaurar datos sin afectar estructura
# =====================================================

source .env.local

BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/landingchat_data_${TIMESTAMP}.sql"

mkdir -p $BACKUP_DIR

PROJECT_REF=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed 's/https:\/\/\([^.]*\).*/\1/')
DB_HOST="${PROJECT_REF}.supabase.co"

echo "🔄 Backup de DATOS solamente..."

pg_dump \
  --host=$DB_HOST \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --data-only \
  --no-owner \
  --no-acl \
  --exclude-table-data='auth.*' \
  --exclude-table-data='storage.*' \
  --file=$BACKUP_FILE

if [ $? -eq 0 ]; then
    gzip $BACKUP_FILE
    echo "✅ Backup de datos completado: ${BACKUP_FILE}.gz"
else
    echo "❌ Error al crear backup"
    exit 1
fi
