const crypto = require('crypto');
const usersService = require('./users-service');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin1234';
const TOKEN_TTL_SECONDS = Number(process.env.ADMIN_TOKEN_TTL_SECONDS || 8 * 60 * 60);

const TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');

const base64urlEncode = (value) => Buffer.from(value).toString('base64url');

const base64urlDecode = (value) => Buffer.from(value, 'base64url').toString('utf-8');

const secureCompare = (left, right) => {
    const leftHash = crypto.createHash('sha256').update(String(left)).digest();
    const rightHash = crypto.createHash('sha256').update(String(right)).digest();
    return crypto.timingSafeEqual(leftHash, rightHash);
};

const sign = (headerPart, payloadPart) => {
    const data = `${headerPart}.${payloadPart}`;
    return crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
};

const createToken = (payload) => {
    const now = Math.floor(Date.now() / 1000);
    const tokenPayload = {
        ...payload,
        iat: now,
        exp: now + TOKEN_TTL_SECONDS
    };

    const headerPart = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadPart = base64urlEncode(JSON.stringify(tokenPayload));
    const signature = sign(headerPart, payloadPart);

    return `${headerPart}.${payloadPart}.${signature}`;
};

const verifyToken = (token) => {
    if (!token || typeof token !== 'string') {
        throw new Error('Token missing');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid token format');
    }

    const [headerPart, payloadPart, providedSignature] = parts;
    const expectedSignature = sign(headerPart, payloadPart);

    if (!secureCompare(providedSignature, expectedSignature)) {
        throw new Error('Invalid token signature');
    }

    let payload;
    try {
        payload = JSON.parse(base64urlDecode(payloadPart));
    } catch {
        throw new Error('Invalid token payload');
    }

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
        throw new Error('Token expired');
    }

    return payload;
};

const authenticateAdmin = (username, password) => {
    return secureCompare(username, ADMIN_USER) && secureCompare(password, ADMIN_PASS);
};

const authenticateAnyUser = async (username, password) => {
    const dbEnabled = process.env.DB_ENABLED === 'true';

    // Intentar primero con usuarios de base de datos
    if (dbEnabled) {
        try {
            const dbUser = await usersService.authenticateUser(username, password);
            if (dbUser) return dbUser;
        } catch {
            // DB habilitada pero falló — NO caer al fallback por seguridad
            return null;
        }
        // DB habilitada y funcionando, pero usuario no encontrado
        return null;
    }

    // Solo si DB no está habilitada, usar fallback de env vars (modo desarrollo)
    if (authenticateAdmin(username, password)) {
        return { username, name: 'Administrador', role: 'admin' };
    }

    return null;
};

const requireAuth = (allowedRoles = []) => async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Auth header missing or invalid' });
    }

    const token = authHeader.slice('Bearer '.length).trim();

    try {
        const payload = verifyToken(token);

        // Verificar que el usuario de DB siga activo
        if (payload.sub_id) {
            try {
                const user = await usersService.getUserById(payload.sub_id);
                if (!user || !user.is_active) {
                    return res.status(401).json({ error: 'Usuario desactivado' });
                }
            } catch {
                // Si falla la verificación, permitir (el token es válido)
            }
        }

        req.user = {
            id: payload.sub_id || null,
            username: payload.sub,
            name: payload.name || payload.sub,
            role: payload.role
        };

        if (allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
            return res.status(403).json({ error: 'Forbidden: rol no autorizado' });
        }

        next();
    } catch {
        return res.status(401).json({ error: 'Token invalido o expirado' });
    }
};

const requireAdmin = requireAuth(['admin']);

module.exports = {
    requireAuth,
    requireAdmin,
    authenticateAdmin,
    authenticateAnyUser,
    createToken,
    verifyToken,
    ADMIN_USER,
    TOKEN_TTL_SECONDS
};
