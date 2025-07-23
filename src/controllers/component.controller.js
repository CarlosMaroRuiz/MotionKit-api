import { PrismaClient } from '@prisma/client';

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
        
        const whereClause = type ? { type } : {};
        
        const components = await prisma.component.findMany({
            where: whereClause,
            select: { 
                id: true, 
                name: true, 
                type: true,
                animationCode: true // ✅ Corregido: removido el objeto anidado
            }
        });
        
        res.json(components);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getComponentsByType = async (req, res) => {
    try {
        const { type } = req.params;
        
        if (!type) {
            return res.status(400).json({ message: 'Type parameter is required' });
        }
        
        const components = await prisma.component.findMany({
            where: { type },
            select: { 
                id: true, 
                name: true, 
                type: true,
                animationCode: true // ✅ Corregido: removido el objeto anidado
            }
        });
        
        res.json(components);
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
        
        // Obtener componentes accesibles
        let accessibleComponents = [];
        
        if (hasPremiumAccess) {
            // Usuario premium: todos los componentes
            const allComponents = await prisma.component.findMany({
                select: { id: true, name: true, type: true }
            });
            accessibleComponents = allComponents.map(c => c.id);
        } else {
            // Usuario gratuito: componentes limitados + donaciones específicas
            const freeComponents = await getFreeAccessibleComponents();
            
            // ✅ Simplificado: obtener TODAS las donaciones del usuario y filtrar después
            const userDonations = await prisma.donation.findMany({
                where: { userId },
                select: { componentId: true }
            });
            
            // Filtrar componentes donados (excluyendo 'premium-access' si existe)
            const paidComponentIds = userDonations
                .map(d => d.componentId)
                .filter(id => id && id !== 'premium-access'); // Excluir premium-access virtual
            
            // Combinar componentes gratuitos + donados (removiendo duplicados)
            accessibleComponents = [...new Set([...freeComponents, ...paidComponentIds])];
        }
        
        res.json({
            user: {
                totalDonated: totalAmount,
                currency: 'MXN',
                isPremium: hasPremiumAccess,
                premiumThreshold: PREMIUM_THRESHOLD,
                freeAccessLimit: FREE_ACCESS_LIMIT
            },
            access: {
                totalAccessibleComponents: accessibleComponents.length,
                accessibleComponentIds: accessibleComponents
            }
        });
        
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};