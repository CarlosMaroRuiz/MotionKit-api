import jwt from 'jsonwebtoken';

export const authRequired = (req, res, next) => {
    const { token } = req.headers;

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    jwt.verify(token, 'secret123', (err, user) => { // Recuerda usar una variable de entorno para el secreto
        if (err) return res.status(403).json({ message: 'Invalid token' });

        req.user = user;
        next();
    });
};