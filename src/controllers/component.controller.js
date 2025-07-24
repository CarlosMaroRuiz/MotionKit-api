import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Constantes del sistema
const FREE_ACCESS_LIMIT = 2;
const PREMIUM_THRESHOLD = 50; // 50 pesos mexicanos
const PREMIUM_COMPONENT_ID = 'premium-access';

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
        where: {
            id: { not: PREMIUM_COMPONENT_ID } // Excluir componente virtual premium
        },
        select: { id: true },
        take: FREE_ACCESS_LIMIT,
        orderBy: { name: 'asc' }
    });
    return components.map(c => c.id);
};

// Función auxiliar para verificar acceso de usuario a un componente específico
const checkUserAccess = async (userId, componentId) => {
    // Verificar si tiene acceso premium
    const hasPremiumAccess = await hasUserPremiumAccess(userId);
    if (hasPremiumAccess) {
        return { hasAccess: true, reason: 'premium' };
    }

    // Verificar si está en los componentes gratuitos
    const freeComponents = await getFreeAccessibleComponents();
    if (freeComponents.includes(componentId)) {
        return { hasAccess: true, reason: 'free' };
    }

    // Verificar si ha donado específicamente por este componente
    const donation = await prisma.donation.findFirst({
        where: {
            userId,
            componentId,
        },
    });

    if (donation) {
        return { hasAccess: true, reason: 'donation' };
    }

    return { hasAccess: false, reason: 'no_access' };
};

// Función para formatear respuesta de componente según acceso
const formatComponentResponse = (component, hasAccess) => {
    if (hasAccess) {
        return component;
    }

    // Si no tiene acceso, devolver datos nulos para campos sensibles
    return {
        id: component.id,
        name: component.name,
        type: component.type,
        jsxCode: null,
        animationCode: null
    };
};

/**
 * GET /api/components - Lista pública de componentes (sin datos sensibles)
 */
export const getComponents = async (req, res) => {
    try {
        const { type } = req.query;
        
        const whereClause = {
            id: { not: PREMIUM_COMPONENT_ID } // Excluir componente virtual
        };
        
        if (type) {
            whereClause.type = type;
        }
        
        // Solo información básica para listado público
        const components = await prisma.component.findMany({
            where: whereClause,
            select: { 
                id: true, 
                name: true, 
                type: true
                // NO incluir jsxCode ni animationCode en listado público
            },
            orderBy: { name: 'asc' }
        });
        
        res.json(components);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/components/type/:type - Componentes por tipo (requiere auth para datos completos)
 */
export const getComponentsByType = async (req, res) => {
    try {
        const { type } = req.params;
        const userId = req.user?.id; // Opcional, puede ser null
        
        if (!type) {
            return res.status(400).json({ message: 'Type parameter is required' });
        }
        
        const components = await prisma.component.findMany({
            where: { 
                type,
                id: { not: PREMIUM_COMPONENT_ID }
            },
            select: { 
                id: true, 
                name: true, 
                type: true,
                jsxCode: true,
                animationCode: true
            },
            orderBy: { name: 'asc' }
        });
        
        // Si no hay usuario autenticado, devolver solo info básica
        if (!userId) {
            const publicComponents = components.map(comp => ({
                id: comp.id,
                name: comp.name,
                type: comp.type,
                jsxCode: null,
                animationCode: null
            }));
            return res.json(publicComponents);
        }

        // Usuario autenticado: verificar acceso a cada componente
        const componentsWithAccess = await Promise.all(
            components.map(async (component) => {
                const { hasAccess } = await checkUserAccess(userId, component.id);
                return formatComponentResponse(component, hasAccess);
            })
        );
        
        res.json(componentsWithAccess);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/components/search - Búsqueda de componentes (requiere auth)
 */
export const searchComponents = async (req, res) => {
    try {
        const { type, id, name, single } = req.query;
        const userId = req.user.id;
        
        // Construir filtros
        const whereClause = {
            id: { not: PREMIUM_COMPONENT_ID }
        };
        
        if (type) whereClause.type = type;
        if (id) whereClause.id = id;
        if (name) {
            whereClause.name = {
                contains: name
            };
        }
        
        // Búsqueda por ID único
        if (id && !name && !type) {
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
            
            if (!component || component.id === PREMIUM_COMPONENT_ID) {
                return res.status(404).json({ 
                    message: `Component with ID '${id}' not found`
                });
            }
            
            const { hasAccess } = await checkUserAccess(userId, component.id);
            return res.json(formatComponentResponse(component, hasAccess));
        }
        
        // Búsquedas múltiples
        const components = await prisma.component.findMany({
            where: whereClause,
            select: { 
                id: true, 
                name: true, 
                type: true,
                jsxCode: true,
                animationCode: true
            },
            orderBy: { name: 'asc' }
        });
        
        // Verificar acceso para cada componente
        const componentsWithAccess = await Promise.all(
            components.map(async (component) => {
                const { hasAccess } = await checkUserAccess(userId, component.id);
                return formatComponentResponse(component, hasAccess);
            })
        );
        
        if (id) {
            if (componentsWithAccess.length === 0) {
                return res.status(404).json({ 
                    message: `Component with ID '${id}' and type '${type || 'any'}' not found`
                });
            }
            return res.json(componentsWithAccess[0]);
        }
        
        if (single === 'true' || componentsWithAccess.length === 1) {
            if (componentsWithAccess.length === 0) {
                return res.status(404).json({ 
                    message: 'No component found matching the criteria',
                    filters: { type: type || null, id: id || null, name: name || null }
                });
            }
            return res.json(componentsWithAccess[0]);
        }
        
        res.json({
            results: componentsWithAccess,
            count: componentsWithAccess.length,
            filters: { type: type || null, id: id || null, name: name || null }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/components/type/:type/id/:id - Componente específico por tipo e ID
 */
export const getComponentByTypeAndId = async (req, res) => {
    try {
        const { type, id } = req.params;
        const userId = req.user.id;
        
        const component = await prisma.component.findFirst({
            where: { 
                type: type,
                id: id,
                id: { not: PREMIUM_COMPONENT_ID }
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
        
        const { hasAccess } = await checkUserAccess(userId, component.id);
        
        if (!hasAccess) {
            return res.status(403).json({ 
                message: 'Access denied. You need premium access or donate for this component.',
                component: {
                    id: component.id,
                    name: component.name,
                    type: component.type,
                    jsxCode: null,
                    animationCode: null
                },
                premiumInfo: {
                    totalNeeded: PREMIUM_THRESHOLD,
                    currency: 'MXN',
                    benefits: 'Unlock entire catalog'
                }
            });
        }
        
        res.json(component);
        
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * POST /api/components - Crear nuevo componente
 */
export const createComponent = async (req, res) => {
    try {
        const { id, name, jsxCode, type, animationCode } = req.body;
        
        if (!name || !jsxCode || !type) {
            return res.status(400).json({ 
                message: 'Name, jsxCode, and type are required fields' 
            });
        }
        
        // Prevenir creación de componentes con ID reservado
        if (id && id.trim() === PREMIUM_COMPONENT_ID) {
            return res.status(400).json({ 
                message: 'This ID is reserved for system use' 
            });
        }
        
        const componentData = {
            name,
            jsxCode,
            type,
            animationCode: animationCode || null
        };
        
        if (id && id.trim() !== '') {
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

/**
 * GET /api/components/:id - Obtener componente específico
 */
export const getComponent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        // Prevenir acceso al componente virtual premium
        if (id === PREMIUM_COMPONENT_ID) {
            return res.status(404).json({ message: 'Component not found' });
        }
        
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
        
        const { hasAccess } = await checkUserAccess(userId, component.id);
        
        if (!hasAccess) {
            return res.status(403).json({ 
                message: 'Access denied. You need premium access or donate for this component.',
                component: {
                    id: component.id,
                    name: component.name,
                    type: component.type,
                    jsxCode: null,
                    animationCode: null
                },
                premiumInfo: {
                    totalNeeded: PREMIUM_THRESHOLD,
                    currency: 'MXN',
                    benefits: 'Unlock entire catalog'
                }
            });
        }
        
        res.json(component);
        
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/components/user/access-info - Información de acceso del usuario
 */
export const getUserAccessInfo = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const totalDonations = await prisma.donation.aggregate({
            where: { userId },
            _sum: { amount: true }
        });
        
        const totalAmount = totalDonations._sum.amount || 0;
        const hasPremiumAccess = totalAmount >= PREMIUM_THRESHOLD;
        
        let accessibleComponents = [];
        
        if (hasPremiumAccess) {
            const allComponents = await prisma.component.findMany({
                where: {
                    id: { not: PREMIUM_COMPONENT_ID }
                },
                select: { id: true }
            });
            accessibleComponents = allComponents.map(c => c.id);
        } else {
            const freeComponents = await getFreeAccessibleComponents();
            const paidComponents = await prisma.donation.findMany({
                where: { 
                    userId, 
                    componentId: { 
                        not: PREMIUM_COMPONENT_ID 
                    } 
                },
                select: { componentId: true }
            });
            
            accessibleComponents = [
                ...freeComponents,
                ...paidComponents.map(d => d.componentId)
            ];
        }
        
        // Eliminar duplicados
        accessibleComponents = [...new Set(accessibleComponents)];
        
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