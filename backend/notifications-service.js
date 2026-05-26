'use strict';

/**
 * notifications-service.js
 * Servicio de notificaciones push usando Firebase Cloud Messaging (FCM).
 */

const path = require('path');
const fs = require('fs');
const config = require('./config');
const db = require('./db');

let firebaseAdmin = null;
let messaging = null;

const toSafeString = (value) => String(value || '').trim();

function initFirebase() {
    if (messaging) return true;

    const serviceAccountPath = config.FIREBASE.SERVICE_ACCOUNT_PATH;
    if (!serviceAccountPath) {
        console.warn('[Notifications] FIREBASE_SERVICE_ACCOUNT_PATH no configurado. Push notifications deshabilitadas.');
        return false;
    }

    let absolutePath = serviceAccountPath;
    if (!path.isAbsolute(serviceAccountPath)) {
        // Dentro del contenedor Docker, el archivo suele estar en el WORKDIR (/app)
        const cwdPath = path.resolve(process.cwd(), serviceAccountPath);
        const parentPath = path.resolve(__dirname, '..', serviceAccountPath);
        if (fs.existsSync(cwdPath)) {
            absolutePath = cwdPath;
        } else if (fs.existsSync(parentPath)) {
            absolutePath = parentPath;
        } else {
            absolutePath = cwdPath;
        }
    }

    if (!fs.existsSync(absolutePath)) {
        console.warn(`[Notifications] Archivo de cuenta de servicio no encontrado: ${absolutePath}. Push notifications deshabilitadas.`);
        return false;
    }

    try {
        const serviceAccount = require(absolutePath);
        firebaseAdmin = require('firebase-admin');
        firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert(serviceAccount)
        });
        messaging = firebaseAdmin.messaging();
        console.log('[Notifications] Firebase Admin SDK inicializado correctamente.');
        return true;
    } catch (err) {
        console.error('[Notifications] Error inicializando Firebase Admin SDK:', err.message);
        return false;
    }
}

async function registerToken(token, platform) {
    const safeToken = toSafeString(token);
    const safePlatform = toSafeString(platform).toLowerCase() === 'ios' ? 'ios' : 'android';

    if (!safeToken) {
        throw new Error('Token es requerido');
    }

    const pool = db.createPool();
    await pool.execute(
        `INSERT INTO push_tokens (token, platform) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE platform = VALUES(platform), created_at = CURRENT_TIMESTAMP`,
        [safeToken, safePlatform]
    );

    return { success: true };
}

async function removeToken(token) {
    const safeToken = toSafeString(token);
    if (!safeToken) {
        throw new Error('Token es requerido');
    }

    const pool = db.createPool();
    await pool.execute('DELETE FROM push_tokens WHERE token = ?', [safeToken]);
    return { success: true };
}

async function getTokenCount() {
    const pool = db.createPool();
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM push_tokens');
    return Number(rows[0]?.count) || 0;
}

async function getHistory(limit = 50) {
    const pool = db.createPool();
    const [rows] = await pool.execute(
        `SELECT id, title, body, type, link, recipients_count, success_count, failure_count, sent_by, sent_at
         FROM sent_notifications
         ORDER BY sent_at DESC
         LIMIT ?`,
        [Number(limit) > 0 ? Number(limit) : 50]
    );
    return rows;
}

async function sendToAll({ title, body, type, link, sentBy }) {
    if (!initFirebase()) {
        throw new Error('Firebase no está configurado. No se pueden enviar notificaciones push.');
    }

    const safeTitle = toSafeString(title);
    const safeBody = toSafeString(body);
    const safeType = toSafeString(type).toLowerCase() === 'live' ? 'live' : 'promo';
    const safeLink = toSafeString(link) || null;

    if (!safeTitle || !safeBody) {
        throw new Error('Titulo y mensaje son requeridos');
    }

    const pool = db.createPool();
    const [rows] = await pool.execute('SELECT token FROM push_tokens');
    const tokens = rows.map((r) => r.token).filter(Boolean);

    if (tokens.length === 0) {
        return { success: false, message: 'No hay dispositivos registrados', recipients: 0 };
    }

    // FCM multicast supports up to 500 tokens per call
    const BATCH_SIZE = 500;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batch = tokens.slice(i, i + BATCH_SIZE);
        try {
            const response = await messaging.sendEachForMulticast({
                tokens: batch,
                notification: {
                    title: safeTitle,
                    body: safeBody
                },
                data: {
                    type: safeType,
                    link: safeLink || '',
                    click_action: 'FLUTTER_NOTIFICATION_CLICK'
                },
                android: {
                    priority: 'high',
                    notification: {
                        channelId: 'modasnancy_default',
                        sound: 'default'
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default'
                        }
                    }
                }
            });

            successCount += response.successCount;
            failureCount += response.failureCount;

            // Clean up invalid tokens
            if (response.responses) {
                const invalidTokens = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const errorCode = resp.error?.code || resp.error?.message || '';
                        if (
                            errorCode.includes('registration-token-not-registered') ||
                            errorCode.includes('invalid-registration-token') ||
                            errorCode.includes('messaging/invalid-registration-token') ||
                            errorCode.includes('messaging/registration-token-not-registered')
                        ) {
                            invalidTokens.push(batch[idx]);
                        }
                    }
                });

                if (invalidTokens.length > 0) {
                    const placeholders = invalidTokens.map(() => '?').join(',');
                    await pool.execute(`DELETE FROM push_tokens WHERE token IN (${placeholders})`, invalidTokens);
                }
            }
        } catch (batchErr) {
            console.error('[Notifications] Error enviando batch:', batchErr.message);
            failureCount += batch.length;
        }
    }

    // Guardar en historial
    await pool.execute(
        `INSERT INTO sent_notifications (title, body, type, link, recipients_count, success_count, failure_count, sent_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [safeTitle, safeBody, safeType, safeLink, tokens.length, successCount, failureCount, sentBy || null]
    );

    return {
        success: true,
        recipients: tokens.length,
        successCount,
        failureCount
    };
}

module.exports = {
    registerToken,
    removeToken,
    getTokenCount,
    getHistory,
    sendToAll
};

// Prueba de inicializacion al cargar el modulo para mostrar estado en los logs
if (initFirebase()) {
    console.log('[Notifications] Firebase esta listo para enviar notificaciones push.');
} else {
    console.warn('[Notifications] Firebase no se pudo inicializar. Las notificaciones push estaran deshabilitadas hasta que se configure correctamente el archivo de cuenta de servicio.');
}
