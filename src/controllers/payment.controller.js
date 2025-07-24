import { PrismaClient } from '@prisma/client';
import { HOST, PAYPAL_API_URL, PAYPAL_API_CLIENT, PAYPAL_API_SECRET } from '../config.js';
import axios from 'axios';

const prisma = new PrismaClient();

const PREMIUM_THRESHOLD = 50; // 50 pesos mexicanos
const USD_TO_MXN_RATE = 17; // Tasa de cambio aproximada
const PREMIUM_COMPONENT_ID = 'premium-access'; // ID especial para donaciones premium

// Función para asegurar que el componente premium existe
async function ensurePremiumComponentExists() {
    const premiumComponent = await prisma.component.findUnique({
        where: { id: PREMIUM_COMPONENT_ID }
    });
    
    if (!premiumComponent) {
        await prisma.component.create({
            data: {
                id: PREMIUM_COMPONENT_ID,
                name: 'Premium Access',
                jsxCode: '// This is a virtual component for premium access tracking',
                type: 'premium',
                animationCode: null
            }
        });
    }
}

// Función para obtener token de PayPal
async function getPayPalAccessToken() {
    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');

        const { data } = await axios.post(`${PAYPAL_API_URL}/v1/oauth2/token`, params, {
            auth: { username: PAYPAL_API_CLIENT, password: PAYPAL_API_SECRET },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return data.access_token;
    } catch (error) {
        console.error('Error getting PayPal access token:', error.response?.data || error.message);
        throw new Error('Failed to authenticate with PayPal');
    }
}

// Función para validar datos de entrada
function validateOrderData(data) {
    const errors = [];
    
    if (!data.amount || isNaN(parseFloat(data.amount)) || parseFloat(data.amount) <= 0) {
        errors.push('Amount must be a positive number');
    }
    
    if (data.componentId && typeof data.componentId !== 'string') {
        errors.push('ComponentId must be a string');
    }
    
    if (data.isPremiumUpgrade !== undefined && typeof data.isPremiumUpgrade !== 'boolean') {
        errors.push('isPremiumUpgrade must be a boolean');
    }
    
    return errors;
}

/**
 * POST /api/payment/create-order - Crear orden de pago
 */
export const createOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, componentId, isPremiumUpgrade = false } = req.body;

        // Validar datos de entrada
        const validationErrors = validateOrderData(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: validationErrors
            });
        }

        // Verificar si es upgrade premium y si el usuario ya lo tiene
        if (isPremiumUpgrade) {
            const totalDonations = await prisma.donation.aggregate({
                where: { userId },
                _sum: { amount: true }
            });
            
            const currentTotal = totalDonations._sum.amount || 0;
            
            if (currentTotal >= PREMIUM_THRESHOLD) {
                return res.status(400).json({
                    success: false,
                    message: 'User already has premium access',
                    data: {
                        currentTotal,
                        premiumThreshold: PREMIUM_THRESHOLD,
                        isPremium: true
                    }
                });
            }
        }

        // Verificar que el componente existe si se especifica
        let componentName = null;
        if (componentId && componentId !== PREMIUM_COMPONENT_ID) {
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
            
            componentName = component.name;
        }

        // Asegurar que el componente premium existe si es necesario
        if (isPremiumUpgrade || componentId === PREMIUM_COMPONENT_ID) {
            await ensurePremiumComponentExists();
            componentName = 'Premium Access';
        }

        // Determinar el componentId final
        const finalComponentId = isPremiumUpgrade ? PREMIUM_COMPONENT_ID : componentId;

        // Convertir MXN a USD para PayPal
        const amountMXN = parseFloat(amount);
        const amountInUSD = (amountMXN / USD_TO_MXN_RATE).toFixed(2);

        // Crear descripción basada en el tipo de pago
        let description = 'Component Store Donation';
        if (isPremiumUpgrade) {
            description = 'Premium Access Upgrade - Component Store';
        } else if (componentId) {
            description = `Component Access - ${componentName || componentId}`;
        }

        // Construir URL de retorno con parámetros para la página de éxito
        const returnParams = new URLSearchParams({
            componentId: finalComponentId || '',
            userId: userId,
            amount: amountMXN.toString(),
            isPremiumUpgrade: isPremiumUpgrade.toString(),
            componentName: componentName || ''
        }).toString();

        const order = {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'USD',
                    value: amountInUSD,
                },
                description: description
            }],
            application_context: {
                brand_name: 'Component Store',
                landing_page: 'NO_PREFERENCE',
                user_action: 'PAY_NOW',
                return_url: `${HOST}/api/payment/capture-order?${returnParams}`,
                cancel_url: `${HOST}/api/payment/cancel-order`,
            },
        };

        // Obtener token de PayPal y crear orden
        const access_token = await getPayPalAccessToken();
        
        const orderResponse = await axios.post(`${PAYPAL_API_URL}/v2/checkout/orders`, order, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${access_token}`,
            },
        });

        const approvalLink = orderResponse.data.links.find(link => link.rel === 'approve');

        res.status(201).json({
            success: true,
            message: 'PayPal order created successfully',
            data: {
                orderId: orderResponse.data.id,
                status: orderResponse.data.status,
                approvalUrl: approvalLink?.href,
                amount: {
                    mxn: amountMXN,
                    usd: parseFloat(amountInUSD)
                },
                componentId: finalComponentId,
                componentName: componentName,
                isPremiumUpgrade,
                links: orderResponse.data.links
            }
        });

    } catch (error) {
        console.error('Error creating PayPal order:', error.response?.data || error.message);
        
        res.status(500).json({
            success: false,
            message: 'Error creating PayPal order',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * GET /api/payment/capture-order - Capturar orden y redirigir a HTML de éxito
 */
export const captureOrder = async (req, res) => {
    try {
        const { token, componentId, userId, amount, isPremiumUpgrade, componentName } = req.query;

        // Validar parámetros requeridos
        if (!token || !userId || !amount) {
            return res.redirect(`/payment-error.html?error=${encodeURIComponent('Missing required payment parameters')}`);
        }

        // Obtener token de PayPal y capturar la orden
        const access_token = await getPayPalAccessToken();

        const captureResponse = await axios.post(
            `${PAYPAL_API_URL}/v2/checkout/orders/${token}/capture`, 
            {}, 
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${access_token}`,
                }
            }
        );

        // Verificar que el pago fue exitoso
        if (captureResponse.data.status !== 'COMPLETED') {
            const errorMsg = `Payment not completed. Status: ${captureResponse.data.status}`;
            return res.redirect(`/payment-error.html?error=${encodeURIComponent(errorMsg)}`);
        }

        // Obtener detalles del pago de PayPal
        const paymentDetails = captureResponse.data.purchase_units[0].payments.captures[0];
        
        // Determinar el componentId correcto
        let finalComponentId = componentId;
        if (isPremiumUpgrade === 'true') {
            await ensurePremiumComponentExists();
            finalComponentId = PREMIUM_COMPONENT_ID;
        }

        // Verificar si ya existe una donación para este usuario y componente
        const existingDonation = await prisma.donation.findUnique({
            where: {
                userId_componentId: {
                    userId,
                    componentId: finalComponentId || PREMIUM_COMPONENT_ID
                }
            }
        });

        let donation;
        const donationAmount = parseFloat(amount);

        if (existingDonation) {
            // Actualizar donación existente (sumar al monto)
            donation = await prisma.donation.update({
                where: {
                    userId_componentId: {
                        userId,
                        componentId: finalComponentId || PREMIUM_COMPONENT_ID
                    }
                },
                data: {
                    amount: existingDonation.amount + donationAmount
                }
            });
        } else {
            // Crear nueva donación
            donation = await prisma.donation.create({
                data: {
                    amount: donationAmount,
                    userId,
                    componentId: finalComponentId || PREMIUM_COMPONENT_ID
                }
            });
        }

        // Calcular totales del usuario
        const totalDonations = await prisma.donation.aggregate({
            where: { userId },
            _sum: { amount: true }
        });
        
        const newTotal = totalDonations._sum.amount || 0;
        const nowHasPremium = newTotal >= PREMIUM_THRESHOLD;
        const wasUpgradeToPremium = !existingDonation && nowHasPremium && (newTotal - donationAmount) < PREMIUM_THRESHOLD;

        // Construir URL de éxito con todos los parámetros necesarios
        const successParams = new URLSearchParams({
            amount: donationAmount.toString(),
            currency: 'MXN',
            transactionId: paymentDetails.id,
            orderId: token,
            total: newTotal.toString(),
            isPremium: (nowHasPremium || wasUpgradeToPremium).toString(),
            componentId: finalComponentId === PREMIUM_COMPONENT_ID ? '' : (finalComponentId || ''),
            componentName: componentName || '',
            paymentDate: new Date().toISOString(),
            wasUpgraded: wasUpgradeToPremium.toString()
        }).toString();

        // Redirigir a página de éxito HTML
        res.redirect(`/payment-success.html?${successParams}`);

    } catch (error) {
        console.error('Error capturing PayPal order:', error.response?.data || error.message);
        
        // En caso de error, redirigir a página de error
        const errorMsg = error.message || 'Unknown error processing payment';
        res.redirect(`/payment-error.html?error=${encodeURIComponent(errorMsg)}&orderId=${req.query.token || ''}`);
    }
};

/**
 * GET /api/payment/cancel-order - Manejar cancelación de pago
 */
export const cancelOrder = (req, res) => {
    // Redirigir a página de cancelación HTML
    res.redirect('/payment-cancelled.html');
};

/**
 * GET /api/payment/order-status/:orderId - Verificar estado de una orden (mantener JSON)
 */
export const getOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        // Obtener token de PayPal
        const access_token = await getPayPalAccessToken();

        // Consultar el estado de la orden en PayPal
        const orderResponse = await axios.get(
            `${PAYPAL_API_URL}/v2/checkout/orders/${orderId}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${access_token}`,
                }
            }
        );

        const orderData = orderResponse.data;

        res.status(200).json({
            success: true,
            message: 'Order status retrieved successfully',
            data: {
                orderId: orderData.id,
                status: orderData.status,
                createTime: orderData.create_time,
                updateTime: orderData.update_time,
                amount: orderData.purchase_units[0].amount,
                links: orderData.links,
                userId
            }
        });

    } catch (error) {
        console.error('Error getting order status:', error.response?.data || error.message);
        
        if (error.response?.status === 404) {
            return res.status(404).json({
                success: false,
                message: 'Order not found',
                data: { orderId: req.params.orderId }
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Error retrieving order status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * GET /api/payment/pricing-info - Obtener información de precios (mantener JSON)
 */
export const getPricingInfo = async (req, res) => {
    try {
        const userId = req.user?.id;
        let userInfo = null;

        if (userId) {
            const totalDonations = await prisma.donation.aggregate({
                where: { userId },
                _sum: { amount: true }
            });
            
            const totalDonated = totalDonations._sum.amount || 0;
            
            userInfo = {
                totalDonated,
                currency: 'MXN',
                isPremium: totalDonated >= PREMIUM_THRESHOLD,
                remainingForPremium: Math.max(0, PREMIUM_THRESHOLD - totalDonated),
                donationHistory: await prisma.donation.findMany({
                    where: { userId },
                    select: {
                        id: true,
                        amount: true,
                        componentId: true,
                        component: {
                            select: { name: true, type: true }
                        }
                    },
                    orderBy: { id: 'desc' }
                })
            };
        }

        res.status(200).json({
            success: true,
            message: 'Pricing information retrieved successfully',
            data: {
                pricing: {
                    premiumThreshold: PREMIUM_THRESHOLD,
                    currency: 'MXN',
                    freeAccessLimit: 2,
                    minimumDonation: 1,
                    premiumBenefits: [
                        'Access to entire component catalog',
                        'All animation codes included',
                        'Priority support',
                        'Early access to new components'
                    ]
                },
                user: userInfo,
                exchangeRate: {
                    note: 'Payments processed in USD via PayPal',
                    approximateRate: USD_TO_MXN_RATE,
                    lastUpdated: new Date().toISOString()
                }
            }
        });
    } catch (error) {
        console.error('Error getting pricing info:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving pricing information',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};