#!/bin/bash
# ============================================================
# deploy.sh — Script de deploy para modasnancy en VPS
# Uso: ./deploy.sh
# ============================================================

set -e  # Salir si cualquier comando falla

PROJECT_DIR="/srv/modasnancy.com"
COMPOSE_FILE="docker-compose.yml"

echo "========================================"
echo "  Deploy Modas Nancy"
echo "========================================"
echo ""

# 1. Entrar al directorio
cd "$PROJECT_DIR" || {
    echo "Error: No se pudo entrar a $PROJECT_DIR"
    exit 1
}

# 2. Backup rapido del .env actual
echo "[1/6] Backup de .env..."
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "  .env respaldado."
else
    echo "  Advertencia: No hay .env. Creando desde .env.example..."
    cp .env.example .env
    echo "  IMPORTANTE: Edita .env con las credenciales reales antes de continuar."
    exit 1
fi

# 3. Pull del repositorio
echo "[2/6] Git pull..."
git fetch origin
git reset --hard origin/master  # Fuerza sincronizacion completa
git pull origin master
echo "  Codigo actualizado."

# 4. Crear directorios de datos si no existen
echo "[3/6] Verificando directorios de datos..."
mkdir -p data/products data/tmp
echo "  OK."

# 5. Permisos
echo "[4/6] Ajustando permisos..."
# El usuario que corre el deploy necesita permisos sobre todo
# Los contenedores Docker acceden via volumenes monturados
chmod -R 755 frontend/
chmod -R 755 backend/
chmod -R 755 database/
chmod -R 755 scripts/
chmod 644 nginx.conf docker-compose.yml .env.example
chmod 600 .env 2>/dev/null || true
# Directorio de datos: permisos para que el contenedor de Nginx y backend puedan escribir
chmod -R 777 data/ 2>/dev/null || sudo chmod -R 777 data/
echo "  Permisos listos."

# 6. Docker Compose down + up
echo "[5/6] Reiniciando contenedores..."
docker compose down
docker compose up --build -d
echo "  Contenedores reiniciados."

# 7. Health check
echo "[6/6] Verificando servicios..."
sleep 3

if curl -sf http://localhost:8080/api/products > /dev/null 2>&1; then
    echo "  API OK: http://localhost:8080/api/products"
else
    echo "  Advertencia: API no responde aun. Revisar logs: docker compose logs backend"
fi

if curl -sf http://localhost:8080/index.html > /dev/null 2>&1; then
    echo "  Frontend OK: http://localhost:8080"
else
    echo "  Advertencia: Frontend no responde aun."
fi

echo ""
echo "========================================"
echo "  Deploy completado!"
echo "========================================"
echo ""
echo "URLs:"
echo "  Tienda:    http://localhost:8080"
echo "  API:       http://localhost:8080/api/products"
echo "  Admin:     http://localhost:8080/admin.html"
echo ""
echo "Comandos utiles:"
echo "  docker compose logs -f backend"
echo "  docker compose logs -f frontend"
echo "  docker compose logs -f db"
echo ""
