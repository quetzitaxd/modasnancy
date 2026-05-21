# Backup Automatico Diario - Instrucciones de Instalacion

## Que hace?
Todos los dias a las **3:00 AM** se ejecuta automaticamente:
1. **Backup de la base de datos** (`mysqldump` del contenedor MariaDB)
2. **Backup de archivos** (`tar.gz` de la carpeta `data/` con imagenes y ordenes)
3. **Rotacion automatica**: borra backups con mas de **15 dias**

---

## Instalacion en la VPS (Debian/Ubuntu)

Conectate por SSH a tu VPS y ejecuta:

```bash
cd /srv/modasnancy

# 1. Crear carpeta de backups
sudo mkdir -p /srv/backups

# 2. Dar permisos de ejecucion al script
sudo chmod +x /srv/modasnancy/scripts/backup.sh

# 3. Instalar la tarea cron
sudo cp /srv/modasnancy/scripts/cron-modasnancy-backup /etc/cron.d/modasnancy-backup
sudo chmod 644 /etc/cron.d/modasnancy-backup

# 4. Recargar cron (Debian usa 'cron', no 'cron.service')
sudo service cron restart
# o si no funciona:
# sudo systemctl restart cron
# o si cron no esta instalado:
# sudo apt update && sudo apt install cron -y

# 5. Probar el backup manualmente (recomendado)
sudo /srv/modasnancy/scripts/backup.sh

# 6. Verificar que se crearon los archivos
ls -lah /srv/backups/$(date +%Y-%m-%d)/

# 7. Revisar el log
cat /srv/backups/backup.log
```

---

## Estructura de backups

```
/srv/backups/
├── 2025-05-01/
│   ├── modasnancy_db_2025-05-01.sql.gz
│   └── modasnancy_data_2025-05-01.tar.gz
├── 2025-05-02/
│   ├── modasnancy_db_2025-05-02.sql.gz
│   └── modasnancy_data_2025-05-02.tar.gz
└── backup.log
```

---

## Restaurar un backup

### Base de datos
```bash
# Descomprimir primero
gunzip /srv/backups/2025-05-01/modasnancy_db_2025-05-01.sql.gz

# Restaurar en el contenedor
docker exec -i modasnancy-db mysql -u modasnancy_user -pTU_DB_PASSWORD modasnancy_db < /srv/backups/2025-05-01/modasnancy_db_2025-05-01.sql
```

### Archivos (data)
```bash
# Extraer en el directorio del proyecto
cd /srv/modasnancy
tar -xzf /srv/backups/2025-05-01/modasnancy_data_2025-05-01.tar.gz
```

---

## Verificar que el cron esta activo

```bash
# Ver la tarea instalada
cat /etc/cron.d/modasnancy-backup

# Ver logs del sistema si algo falla
sudo grep CRON /var/log/syslog | tail -20
```

---

## Solucion de problemas

### "Unit cron.service not found"
Significa que `cron` no esta instalado o usa otro nombre:
```bash
sudo apt update && sudo apt install cron -y
sudo service cron start
```

### "syntax error near unexpected token"
Asegurate de que el script no tenga caracteres especiales. Vuelve a copiarlo desde el repositorio.
