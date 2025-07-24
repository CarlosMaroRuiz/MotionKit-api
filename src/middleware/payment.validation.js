import { body, param, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Middleware para manejar errores de validación
 */
export const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation errors',
            errors: errors.array().map(error => ({
                field: error.path,
                message: error.msg,
                value: error.value
            }))
        });
    }
    next();
};

/**
 * Validaciones para crear orden de pago
 */
export const validateCreateOrder = [
    body('amount')
        .isFloat({ min: 1, max: 10000 })
        .withMessage('Amount must be a number between 1 and 10000 MXN'),
    
    body('componentId')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('ComponentId must be a string between 1 and 100 characters')
        .custom(async (value) => {
            if (value === 'premium-access') {
                return true; // Permitir componente premium
            }
            const component = await prisma.component.findUnique({
                where: { id: value }
            });
            if (!component) {
                throw new Error('Component does not exist');
            }
            return true;
        }),
    
    body('isPremiumUpgrade')
        .optional()
        .isBoolean()
        .withMessage('isPremiumUpgrade must be a boolean value'),
    
    // Validación condicional: si es premium upgrade, el amount debe ser suficiente
    body().custom(async (value, { req }) => {
        if (req.body.isPremiumUpgrade === true) {
            const userId = req.user.id;
            
            // Obtener total actual del usuario
            const totalDonations = await prisma.donation.aggregate({
                where: { userId },
                _sum: { amount: true }
            });
            
            const currentTotal = totalDonations._sum.amount || 0;
            const newTotal = currentTotal + parseFloat(req.body.amount);
            
            if (newTotal < 50) {
                throw new Error(`Premium upgrade requires total donations of 50 MXN. Current: ${currentTotal} MXN, after payment: ${newTotal} MXN`);
            }
        }
        return true;
    }),
    
    handleValidationErrors
];

/**
 * Validaciones para capturar orden
 */
export const validateCaptureOrder = [
    query('token')
        .notEmpty()
        .isString()
        .trim()
        .isLength({ min: 10, max: 200 })
        .withMessage('PayPal token is required and must be valid format'),
    
    query('userId')
        .notEmpty()
        .isUUID()
        .withMessage('Valid userId is required')
        .custom(async (value) => {
            const user = await prisma.user.findUnique({
                where: { id: value }
            });
            if (!user) {
                throw new Error('User does not exist');
            }
            return true;
        }),
    
    query('amount')
        .notEmpty()
        .isFloat({ min: 1, max: 10000 })
        .withMessage('Amount must be a number between 1 and 10000'),
    
    query('componentId')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('ComponentId must be a valid string'),
    
    query('isPremiumUpgrade')
        .optional()
        .isIn(['true', 'false'])
        .withMessage('isPremiumUpgrade must be "true" or "false"'),
    
    handleValidationErrors
];

/**
 * Validaciones para obtener estado de orden
 */
export const validateOrderStatus = [
    param('orderId')
        .notEmpty()
        .isString()
        .trim()
        .isLength({ min: 10, max: 50 })
        .withMessage('Valid PayPal orderId is required'),
    
    handleValidationErrors
];

/**
 * Middleware para validar configuración de PayPal
 */
export const validatePayPalConfig = (req, res, next) => {
    const { PAYPAL_API_CLIENT, PAYPAL_API_SECRET, PAYPAL_API_URL } = process.env;
    
    if (!PAYPAL_API_CLIENT || !PAYPAL_API_SECRET || !PAYPAL_API_URL) {
        return res.status(500).json({
            success: false,
            message: 'PayPal configuration is incomplete',
            error: 'Missing required PayPal environment variables'
        });
    }
    
    next();
};

/**
 * Middleware para verificar si el usuario ya tiene acceso premium
 */
export const checkPremiumStatus = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { isPremiumUpgrade } = req.body;
        
        // Solo verificar si es un upgrade premium
        if (isPremiumUpgrade === true) {
            const totalDonations = await prisma.donation.aggregate({
                where: { userId },
                _sum: { amount: true }
            });
            
            const currentTotal = totalDonations._sum.amount || 0;
            
            if (currentTotal >= 50) {
                return res.status(400).json({
                    success: false,
                    message: 'User already has premium access',
                    data: {
                        currentTotal,
                        premiumThreshold: 50,
                        isPremium: true
                    }
                });
            }
        }
        
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error checking premium status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Middleware para validar acceso a componente específico
 */
export const validateComponentAccess = async (req, res, next) => {
    try {
        const { componentId } = req.body;
        const userId = req.user.id;
        
        // Si no hay componentId específico, continuar
        if (!componentId || componentId === 'premium-access') {
            return next();
        }
        
        // Verificar si el componente existe
        const component = await prisma.component.findUnique({
            where: { id: componentId }
        });
        
        if (!component) {
            return res.status(404).json({
                success: false,
                message: 'Component not found',
                data: { componentId }
            });
        }
        
        // Verificar si el usuario ya tiene acceso
        const existingDonation = await prisma.donation.findUnique({
            where: {
                userId_componentId: {
                    userId,
                    componentId
                }
            }
        });
        
        if (existingDonation) {
            return res.status(400).json({
                success: false,
                message: 'User already has access to this component',
                data: {
                    componentId,
                    existingDonation: {
                        amount: existingDonation.amount,
                        id: existingDonation.id
                    }
                }
            });
        }
        
        // Verificar si tiene acceso premium
        const totalDonations = await prisma.donation.aggregate({
            where: { userId },
            _sum: { amount: true }
        });
        
        if ((totalDonations._sum.amount || 0) >= 50) {
            return res.status(400).json({
                success: false,
                message: 'User already has premium access to all components',
                data: {
                    totalDonated: totalDonations._sum.amount,
                    isPremium: true
                }
            });
        }
        
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error validating component access',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Middleware de rate limiting para pagos (prevenir spam)
 */
export const paymentRateLimit = (req, res, next) => {
    // Implementación básica de rate limiting
    // En producción, usar redis o similar
    const userId = req.user.id;
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5 minutos
    const maxAttempts = 10;
    
    // Simular storage en memoria (usar Redis en producción)
    if (!global.paymentAttempts) {
        global.paymentAttempts = new Map();
    }
    
    const userAttempts = global.paymentAttempts.get(userId) || [];
    const recentAttempts = userAttempts.filter(timestamp => now - timestamp < windowMs);
    
    if (recentAttempts.length >= maxAttempts) {
        return res.status(429).json({
            success: false,
            message: 'Too many payment attempts. Please try again later.',
            data: {
                retryAfter: Math.ceil((windowMs - (now - recentAttempts[0])) / 1000),
                maxAttempts,
                windowMinutes: windowMs / (60 * 1000)
            }
        });
    }
    
    // Registrar intento actual
    recentAttempts.push(now);
    global.paymentAttempts.set(userId, recentAttempts);
    
    next();
};

/**
 * Middleware para limpiar datos sensibles de respuestas
 */
export const sanitizeResponse = (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
        // Remover información sensible en producción
        if (process.env.NODE_ENV === 'production' && data.error) {
            delete data.error;
        }
        
        // Agregar timestamp a todas las respuestas
        if (typeof data === 'object' && data !== null) {
            data.timestamp = new Date().toISOString();
        }
        
        originalJson.call(this, data);
    };
    
    next();
};