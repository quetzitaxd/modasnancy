'use strict';

/**
 * payments-service.js
 *
 * Cliente de CuboPago API para procesar pagos con tarjeta.
 * Documentación: https://developers.cubopago.com
 */

const https = require('https');
const config = require('./config');

class PaymentError extends Error {
    constructor(message, status = 400, code = null) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

/**
 * HTTP request helper para CuboPago API con reintentos.
 */
const cuboPagoRequest = async (path, payload, retries = 2) => {
    let lastError;
    const { CUBOPAGO } = config;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await new Promise((resolve, reject) => {
                if (!CUBOPAGO.API_KEY) {
                    return reject(new PaymentError('CuboPago API key no configurada', 500, 'CONFIG_MISSING'));
                }

                const postData = JSON.stringify(payload);

                const options = {
                    hostname: CUBOPAGO.BASE_URL,
                    path: path,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': CUBOPAGO.API_KEY,
                        'Content-Length': Buffer.byteLength(postData)
                    },
                    timeout: CUBOPAGO.TIMEOUT_MS
                };

                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        try {
                            const parsed = JSON.parse(data);
                            if (res.statusCode >= 200 && res.statusCode < 300) {
                                resolve(parsed);
                            } else {
                                reject(new PaymentError(
                                    parsed.message || parsed.error || `Error CuboPago: ${res.statusCode}`,
                                    res.statusCode,
                                    parsed.statusCode || null
                                ));
                            }
                        } catch (e) {
                            reject(new PaymentError('Respuesta inválida de CuboPago', 502));
                        }
                    });
                });

                req.on('error', (err) => {
                    reject(new PaymentError(`Error de conexión con CuboPago: ${err.message}`, 502));
                });

                req.on('timeout', () => {
                    req.destroy();
                    reject(new PaymentError('Timeout al conectar con CuboPago', 504));
                });

                req.write(postData);
                req.end();
            });
        } catch (err) {
            lastError = err;
            // Solo reintentar en errores de servidor (5xx) o timeout
            if (err.status >= 500 && attempt < retries) {
                await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
                continue;
            }
            throw err;
        }
    }

    throw lastError;
};

/**
 * Procesa un pago directo con datos de tarjeta.
 */
const chargeCard = async (params) => {
    const {
        amount,
        orderId,
        description,
        customerName,
        customerEmail,
        customerPhone,
        card
    } = params;

    if (!amount || amount <= 0) {
        throw new PaymentError('Monto inválido', 400, 'INVALID_AMOUNT');
    }
    if (!card || !card.number || !card.cvv || !card.month || !card.year || !card.holder) {
        throw new PaymentError('Datos de tarjeta incompletos', 400, 'MISSING_CARD_DATA');
    }

    // CuboPago requiere amount en centavos (entero)
    const amountCents = Math.round(amount * 100);

    const payload = {
        clientName: String(customerName || 'Cliente'),
        clientEmail: String(customerEmail || config.BRAND.EMAIL),
        clientPhone: String(customerPhone || config.BRAND.PHONE),
        description: String(description || `Pedido #${orderId} - ${config.BRAND.NAME}`),
        amount: amountCents,
        cardHolder: String(card.holder),
        cardNumber: String(card.number).replace(/\s/g, ''),
        cvv: String(card.cvv),
        month: String(card.month),
        year: String(card.year)
    };

    const result = await cuboPagoRequest('/api/v1/transactions', payload);

    return {
        success: true,
        transactionId: result.referenceId || result.id,
        authorization: result.authorizationCode,
        status: result.status,
        processedAt: result.processedAt,
        raw: result
    };
};

/**
 * Tokeniza una tarjeta para uso futuro.
 */
const tokenizeCard = async (params) => {
    const { customerName, customerEmail, customerPhone, card } = params;

    if (!card || !card.number || !card.cvv || !card.month || !card.year || !card.holder) {
        throw new PaymentError('Datos de tarjeta incompletos', 400, 'MISSING_CARD_DATA');
    }

    const payload = {
        clientName: String(customerName || 'Cliente'),
        clientEmail: String(customerEmail || config.BRAND.EMAIL),
        clientPhone: String(customerPhone || config.BRAND.PHONE),
        cardHolder: String(card.holder),
        cardNumber: String(card.number).replace(/\s/g, ''),
        cvv: String(card.cvv),
        month: String(card.month),
        year: String(card.year)
    };

    const result = await cuboPagoRequest('/api/v1/transactions/tokenization', payload);

    return {
        success: true,
        cardIdentifier: result.cardIdentifier,
        raw: result
    };
};

/**
 * Procesa un pago con tarjeta tokenizada.
 */
const chargeWithToken = async (params) => {
    const {
        amount,
        orderId,
        description,
        customerName,
        customerEmail,
        customerPhone,
        cardIdentifier
    } = params;

    if (!amount || amount <= 0) {
        throw new PaymentError('Monto inválido', 400, 'INVALID_AMOUNT');
    }
    if (!cardIdentifier) {
        throw new PaymentError('Token de tarjeta requerido', 400, 'MISSING_CARD_IDENTIFIER');
    }

    const amountCents = Math.round(amount * 100);

    const payload = {
        clientName: String(customerName || 'Cliente'),
        clientEmail: String(customerEmail || config.BRAND.EMAIL),
        clientPhone: String(customerPhone || config.BRAND.PHONE),
        description: String(description || `Pedido #${orderId} - ${config.BRAND.NAME}`),
        amount: amountCents,
        cardIdentifier: String(cardIdentifier)
    };

    const result = await cuboPagoRequest('/api/v1/transactions', payload);

    return {
        success: true,
        transactionId: result.referenceId || result.id,
        authorization: result.authorizationCode,
        status: result.status,
        processedAt: result.processedAt,
        raw: result
    };
};

module.exports = {
    chargeCard,
    tokenizeCard,
    chargeWithToken,
    PaymentError
};
