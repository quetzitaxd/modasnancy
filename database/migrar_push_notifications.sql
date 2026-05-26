-- ============================================================
-- migrar_push_notifications.sql
-- Tablas para sistema de notificaciones push (FCM)
-- ============================================================

-- --------------------------------------------------
-- 1. Tabla: push_tokens
-- Almacena los tokens FCM de cada dispositivo registrado.
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS push_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(500) NOT NULL UNIQUE,
  platform ENUM('android','ios') NOT NULL DEFAULT 'android',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_platform (platform),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------
-- 2. Tabla: sent_notifications
-- Historial de notificaciones enviadas desde el panel admin.
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS sent_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  type ENUM('live','promo') NOT NULL DEFAULT 'promo',
  link VARCHAR(500) DEFAULT NULL,
  recipients_count INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  failure_count INT NOT NULL DEFAULT 0,
  sent_by VARCHAR(100) DEFAULT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_sent_at (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
