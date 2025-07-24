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
                animationCode: true
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
                animationCode: true
            }
        });
        
        res.json(components);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Nueva función para buscar componentes por tipo e ID
export const searchComponents = async (req, res) => {
    try {
        const { type, id, name, single } = req.query;
        
        // Construir el objeto de filtros dinámicamente
        const whereClause = {};
        
        if (type) {
            whereClause.type = type;
        }
        
        if (id) {
            // Si se proporciona ID, hacer búsqueda exacta ya que los IDs son únicos
            whereClause.id = id;
        }
        
        if (name) {
            // Búsqueda por nombre que contenga el texto (SQLite compatible)
            whereClause.name = {
                contains: name
            };
        }
        
        // Si se busca por ID (que es único), usar findUnique para mayor eficiencia
        if (id && !name && !type) {
            const component = await prisma.component.findUnique({
                where: { id },
                select: { 
                    id: true, 
                    name: true, 
                    type: true,
                    animationCode: true
                }
            });
            
            if (!component) {
                return res.status(404).json({ 
                    message: `Component with ID '${id}' not found`
                });
            }
            
            return res.json(component);
        }
        
        // Para búsquedas combinadas o por otros campos
        const components = await prisma.component.findMany({
            where: whereClause,
            select: { 
                animationCode: true,
                jsxCode: true
            },
            orderBy: { name: 'asc' }
        });
        
        // Si se busca por ID específico (búsqueda exacta), devolver objeto único
        if (id) {
            if (components.length === 0) {
                return res.status(404).json({ 
                    message: `Component with ID '${id}' and type '${type || 'any'}' not found`
                });
            }
            
            // Como el ID es único, siempre debería haber máximo 1 resultado
            return res.json(components[0]);
        }
        
        // Si el parámetro 'single' está presente o solo hay un resultado, devolver el objeto directamente
        if (single === 'true' || components.length === 1) {
            if (components.length === 0) {
                return res.status(404).json({ 
                    message: 'No component found matching the criteria',
                    filters: {
                        type: type || null,
                        id: id || null,
                        name: name || null
                    }
                });
            }
            
            return res.json(components[0]);
        }
        
        // Respuesta estándar con array para búsquedas generales
        res.json({
            results: components,
            count: components.length,
            filters: {
                type: type || null,
                id: id || null,
                name: name || null
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Nueva función para buscar un componente específico por tipo e ID
export const getComponentByTypeAndId = async (req, res) => {
    try {
        const { type, id } = req.params;
        const userId = req.user.id;
        
        // Verificar si el componente existe con el tipo e ID especificados
        const component = await prisma.component.findFirst({
            where: { 
                type: type,
                id: id
            },
            select: { 
                id: true, 
                name: true, 
                type: true, 
                jsxCode: true, 
                animationCode: true 
            }
        });
        
        if (!component) {
            return res.status(404).json({ 
                message: `Component with type '${type}' and ID '${id}' not found` 
            });
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
            const paidComponents = await prisma.donation.findMany({
                where: { userId, componentId: { not: null } },
                select: { componentId: true }
            });
            
            accessibleComponents = [
                ...freeComponents,
                ...paidComponents.map(d => d.componentId)
            ];
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