import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Constante para el límite de acceso gratuito
const FREE_ACCESS_LIMIT = 2;
const PREMIUM_THRESHOLD = 50; // 50 pesos mexicanos

// Función auxiliar para verificar si el usuario tiene acceso premium
const hasUserPremiumAccess = async (userId) => {
    const totalDonations = await prisma.donation.aggregate({
        where: { userId },
        _sum: { amount: true }
    });
    
    return (totalDonations._sum.amount || 0) >= PREMIUM_THRESHOLD;
};

// Función auxiliar para obtener componentes accesibles para usuario gratuito
const getFreeAccessibleComponents = async () => {
    const components = await prisma.component.findMany({
        select: { id: true, name: true, type: true },
        take: FREE_ACCESS_LIMIT,
        orderBy: { name: 'asc' }
    });
    return components.map(c => c.id);
};

export const getComponents = async (req, res) => {
    try {
        const { type } = req.query;
        const token = req.headers.token;
        
        const whereClause = type ? { type } : {};
        
        // Obtener todos los componentes con datos completos
        const components = await prisma.component.findMany({
            where: whereClause,
            select: { 
                id: true, 
                name: true, 
                type: true,
                jsxCode: true,
                animationCode: true
            }
        });
        
        // Si no hay token, devolver componentes con código oculto
        if (!token) {
            const publicComponents = components.map(component => ({
                ...component,
                jsxCode: null,
                animationCode: null
            }));
            return res.json(publicComponents);
        }
        
        // Verificar el usuario y su estado premium
        try {
            const decoded = jwt.verify(token, 'secret123');
            const userId = decoded.id;
            
            // Verificar si tiene acceso premium
            const hasPremiumAccess = await hasUserPremiumAccess(userId);
            
            if (hasPremiumAccess) {
                // Usuario premium: devolver componentes completos
                return res.json(components);
            } else {
                // Usuario no premium: ocultar código
                const limitedComponents = components.map(component => ({
                    ...component,
                    jsxCode: null,
                    animationCode: null
                }));
                return res.json(limitedComponents);
            }
        } catch (tokenError) {
            // Token inválido: devolver componentes con código oculto
            const publicComponents = components.map(component => ({
                ...component,
                jsxCode: null,
                animationCode: null
            }));
            return res.json(publicComponents);
        }
        
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getComponentsByType = async (req, res) => {
    try {
        const { type } = req.params;
        const token = req.headers.token;
        
        if (!type) {
            return res.status(400).json({ message: 'Type parameter is required' });
        }
        
        // Obtener todos los componentes del tipo especificado con datos completos
        const components = await prisma.component.findMany({
            where: { type },
            select: { 
                id: true, 
                name: true, 
                type: true,
                jsxCode: true,
                animationCode: true
            }
        });
        
        // Si no hay token, devolver componentes con código oculto
        if (!token) {
            const publicComponents = components.map(component => ({
                ...component,
                jsxCode: null,
                animationCode: null
            }));
            return res.json(publicComponents);
        }
        
        // Verificar el usuario y su estado premium
        try {
            const decoded = jwt.verify(token, 'secret123');
            const userId = decoded.id;
            
            // Verificar si tiene acceso premium
            const hasPremiumAccess = await hasUserPremiumAccess(userId);
            
            if (hasPremiumAccess) {
                // Usuario premium: devolver componentes completos
                return res.json(components);
            } else {
                // Usuario no premium: ocultar código
                const limitedComponents = components.map(component => ({
                    ...component,
                    jsxCode: null,
                    animationCode: null
                }));
                return res.json(limitedComponents);
            }
        } catch (tokenError) {
            // Token inválido: devolver componentes con código oculto
            const publicComponents = components.map(component => ({
                ...component,
                jsxCode: null,
                animationCode: null
            }));
            return res.json(publicComponents);
        }
        
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createComponent = async (req, res) => {
    try {
        const { id, name, jsxCode, type, animationCode } = req.body;
        
        // Validación básica
        if (!name || !jsxCode || !type) {
            return res.status(400).json({ 
                message: 'Name, jsxCode, and type are required fields' 
            });
        }
        
        const componentData = {
            name,
            jsxCode,
            type,
            animationCode: animationCode || null
        };
        
        // Si se proporciona un ID personalizado, usarlo; sino, auto-generar
        if (id && id.trim() !== '') {
            // Verificar que no exista un componente con este ID
            const existingComponent = await prisma.component.findUnique({
                where: { id: id.trim() }
            });
            
            if (existingComponent) {
                return res.status(409).json({ 
                    message: 'Component with this ID already exists' 
                });
            }
            
            componentData.id = id.trim();
        }
        
        const newComponent = await prisma.component.create({
            data: componentData
        });
        
        res.status(201).json(newComponent);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getComponent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        // Verificar si el componente existe
        const component = await prisma.component.findUnique({
            where: { id },
            select: { 
                id: true, 
                name: true, 
                type: true, 
                jsxCode: true, 
                animationCode: true 
            }
        });
        
        if (!component) {
            return res.status(404).json({ message: 'Component not found' });
        }
        
        // Verificar si el usuario tiene acceso premium
        const hasPremiumAccess = await hasUserPremiumAccess(userId);
        
        if (hasPremiumAccess) {
            // Usuario premium: acceso completo
            return res.json(component);
        }
        
        // Usuario gratuito: verificar límites
        const freeAccessibleComponents = await getFreeAccessibleComponents();
        
        if (freeAccessibleComponents.includes(id)) {
            // Componente dentro del límite gratuito
            return res.json(component);
        }
        
        // Verificar si el usuario ha donado específicamente para este componente
        const donation = await prisma.donation.findFirst({
            where: {
                componentId: id,
                userId: userId,
            },
        });
        
        if (!donation) {
            // Sin acceso: mostrar información limitada
            return res.status(403).json({ 
                message: 'Access denied. You need premium access or donate for this component.',
                component: {
                    id: component.id,
                    name: component.name,
                    type: component.type
                },
                premiumInfo: {
                    totalNeeded: PREMIUM_THRESHOLD,
                    currency: 'MXN',
                    benefits: 'Unlock entire catalog'
                }
            });
        }
        
        // Usuario ha donado por este componente específico
        res.json(component);
        
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getUserAccessInfo = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Calcular total de donaciones del usuario
        const totalDonations = await prisma.donation.aggregate({
            where: { userId },
            _sum: { amount: true }
        });
        
        const totalAmount = totalDonations._sum.amount || 0;
        const hasPremiumAccess = totalAmount >= PREMIUM_THRESHOLD;
        
        // Obtener total de componentes disponibles
        const totalComponents = await prisma.component.count();
        
        res.json({
            user: {
                totalDonated: totalAmount,
                currency: 'MXN',
                isPremium: hasPremiumAccess,
                premiumThreshold: PREMIUM_THRESHOLD,
                freeAccessLimit: FREE_ACCESS_LIMIT
            },
            access: {
                hasFullAccess: hasPremiumAccess,
                totalComponentsAvailable: totalComponents,
                accessLevel: hasPremiumAccess ? 'premium' : 'limited'
            }
        });
        
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};