-- Migración: Limpieza de audit_logs antiguos
-- Ejecutar periódicamente (ej: cron mensual)

-- Eliminar logs de más de 6 meses
-- DELETE FROM audit_logs WHERE changed_at < DATE_SUB(NOW(), INTERVAL 6 MONTH);

-- Alternativa: mantener solo los últimos 10000 registros
-- DELETE FROM audit_logs WHERE id NOT IN (SELECT id FROM (SELECT id FROM audit_logs ORDER BY changed_at DESC LIMIT 10000) AS t);
