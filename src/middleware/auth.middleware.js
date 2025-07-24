import jwt from 'jsonwebtoken';

/**
 * Middleware de autenticación requerida
 */
export const authRequired = (req, res, next) => {
    const { token } = req.headers;

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    jwt.verify(token, 'secret123', (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });

        req.user = user;
        next();
    });
};

/**
 * Middleware de autenticación opcional
 * Permite que el endpoint funcione tanto con como sin autenticación
 * Si hay token válido, agrega user al request
 * Si no hay token o es inválido, continúa sin user
 */
export const authOptional = (req, res, next) => {
    const { token } = req.headers;

    if (!token) {
        // No hay token, continuar sin usuario autenticado
        req.user = null;
        return next();
    }

    jwt.verify(token, 'secret123', (err, user) => {
        if (err) {
            // Token inválido, continuar sin usuario autenticado
            req.user = null;
        } else {
            // Token válido, agregar usuario al request
            req.user = user;
        }
        next();
    });
};