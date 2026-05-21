#!/bin/bash

# =============================================================================
# modasnancy - Backup diario automatico
# Base de datos (MariaDB en Docker) + archivos de data (imagenes, ordenes)
# =============================================================================

set -euo pipefail

# --- Configuracion -----------------------------------------------------------
PROJECT_DIR="/srv/modasnancy"
BACKUP_DIR="/srv/backups"
DATA_DIR="$PROJECT_DIR/data"
DB_CONTAINER="modasnancy-db"
DB_NAME="modasnancy_db"
DB_USER="modasnancy_user"
RETENTION_DAYS=15
LOG_FILE="$BACKUP_DIR/backup.log"

# Leer contrasena desde .env
ENV_FILE="$PROJECT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    DB_PASS=$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d '=' -f2-)
fi

if [ -z "${DB_PASS:-}" ]; then
    echo "[ERROR] No se encontro DB_PASSWORD en $ENV_FILE" >&2
    exit 1
fi

# --- Fecha -------------------------------------------------------------------
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
BACKUP_SUBDIR="$BACKUP_DIR/$DATE"

# --- Funcion de log ----------------------------------------------------------
log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

# --- Crear directorio --------------------------------------------------------
mkdir -p "$BACKUP_SUBDIR"

log "=== Iniciando backup diario ==="

# --- Backup de base de datos -------------------------------------------------
DB_BACKUP_FILE="$BACKUP_SUBDIR/${DB_NAME}_${DATE}.sql.gz"

log "Exportando base de datos..."
if docker exec "$DB_CONTAINER" mysqldump -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" 2>/dev/null | gzip > "$DB_BACKUP_FILE"; then
    DB_SIZE=$(du -h "$DB_BACKUP_FILE" 2>/dev/null | cut -f1)
    log "OK Base de datos exportada: ${DB_NAME}_${DATE}.sql.gz ($DB_SIZE)"
else
    log "ERROR: Fallo el backup de la base de datos"
    exit 1
fi

# --- Backup de archivos (data) -----------------------------------------------
DATA_BACKUP_FILE="$BACKUP_SUBDIR/modasnancy_data_${DATE}.tar.gz"

log "Comprimiendo archivos de data..."
if tar -czf "$DATA_BACKUP_FILE" -C "$PROJECT_DIR" data/ 2>/dev/null; then
    DATA_SIZE=$(du -h "$DATA_BACKUP_FILE" 2>/dev/null | cut -f1)
    log "OK Archivos comprimidos: modasnancy_data_${DATE}.tar.gz ($DATA_SIZE)"
else
    log "ERROR: Fallo el backup de archivos"
    exit 1
fi

# --- Rotacion: borrar backups antiguos ---------------------------------------
log "Limpiando backups de mas de $RETENTION_DIAS dias..."
DELETED=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]" -mtime +$RETENTION_DAYS -print 2>/dev/null | wc -l)
find "$BACKUP_DIR" -maxdepth 1 -type d -name "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]" -mtime +$RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true
log "OK Limpieza completada. Carpetas eliminadas: $DELETED"

# --- Resumen -----------------------------------------------------------------
log "Resumen: DB=$DB_SIZE | Data=$DATA_SIZE | Ruta=$BACKUP_SUBDIR"
log "=== Backup finalizado con exito ==="
