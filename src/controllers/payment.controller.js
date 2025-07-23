import { PrismaClient } from '@prisma/client';
import { HOST, PAYPAL_API_URL, PAYPAL_API_CLIENT, PAYPAL_API_SECRET } from '../config.js';
import axios from 'axios';

const prisma = new PrismaClient();

const PREMIUM_THRESHOLD = 50; // 50 pesos mexicanos
const USD_TO_MXN_RATE = 17; // Tasa de cambio aproximada (deberías obtenerla de una API)
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

export const createOrder = async (req, res) => {
    try {
        const { amount, componentId, isPremiumUpgrade } = req.body;
        const userId = req.user.id;

        // Validaciones
        if (parseFloat(amount) <= 0) {
            return res.status(400).json({ message: 'Donation amount must be greater than 0.' });
        }

        // Si es upgrade premium, verificar que no sea ya premium
        if (isPremiumUpgrade) {
            const totalDonations = await prisma.donation.aggregate({
                where: { userId },
                _sum: { amount: true }
            });
            
            const currentTotal = totalDonations._sum.amount || 0;
            if (currentTotal >= PREMIUM_THRESHOLD) {
                return res.status(400).json({ 
                    message: 'User already has premium access.' 
                });
            }
            
            // Asegurar que el componente premium existe
            await ensurePremiumComponentExists();
        }

        // Si no es upgrade premium, verificar que el componente existe
        if (!isPremiumUpgrade && componentId) {
            const component = await prisma.component.findUnique({
                where: { id: componentId }
            });
            
            if (!component) {
                return res.status(404).json({ message: 'Component not found.' });
            }

            // Verificar si ya donó por este componente
            const existingDonation = await prisma.donation.findFirst({
                where: {
                    userId,
                    componentId
                }
            });
            
            if (existingDonation) {
                return res.status(400).json({ 
                    message: 'You have already donated for this component.' 
                });
            }
        }

        // Convertir MXN a USD para PayPal (PayPal trabaja en USD)
        const amountInUSD = (parseFloat(amount) / USD_TO_MXN_RATE).toFixed(2);

        const order = {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'USD',
                    value: amountInUSD,
                },
                description: isPremiumUpgrade 
                    ? 'Premium Access Upgrade - Component Store'
                    : `Access to component: ${componentId || 'Custom'}`
            }],
            application_context: {
                brand_name: 'Component Store',
                landing_page: 'NO_PREFERENCE',
                user_action: 'PAY_NOW',
                return_url: `${HOST}/api/payment/capture-order?componentId=${isPremiumUpgrade ? PREMIUM_COMPONENT_ID : componentId || ''}&userId=${userId}&amount=${amount}&isPremiumUpgrade=${isPremiumUpgrade || false}`,
                cancel_url: `${HOST}/api/payment/cancel-order`,
            },
        };

        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');

        const { data: { access_token } } = await axios.post(`${PAYPAL_API_URL}/v1/oauth2/token`, params, {
            auth: { username: PAYPAL_API_CLIENT, password: PAYPAL_API_SECRET },
        });

        const orderResponse = await axios.post(`${PAYPAL_API_URL}/v2/checkout/orders`, order, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${access_token}`,
            },
        });
        
        res.json({
            ...orderResponse.data,
            metadata: {
                amountMXN: amount,
                amountUSD: amountInUSD,
                isPremiumUpgrade: isPremiumUpgrade || false,
                componentId: isPremiumUpgrade ? PREMIUM_COMPONENT_ID : (componentId || null)
            }
        });

    } catch (error) {
        console.error('Error creating PayPal order:', error);
        res.status(500).json({ message: "Error creating PayPal order" });
    }
};

export const captureOrder = async (req, res) => {
    try {
        const { token, componentId, userId, amount, isPremiumUpgrade } = req.query;

        // Capturar el pago en PayPal
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');

        const { data: { access_token } } = await axios.post(`${PAYPAL_API_URL}/v1/oauth2/token`, params, {
            auth: { username: PAYPAL_API_CLIENT, password: PAYPAL_API_SECRET },
        });

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
            throw new Error('Payment was not completed successfully');
        }

        // Determinar el componentId correcto
        let finalComponentId = componentId;
        if (isPremiumUpgrade === 'true') {
            await ensurePremiumComponentExists();
            finalComponentId = PREMIUM_COMPONENT_ID;
        }

        // Guardar la donación en la base de datos
        const donationData = {
            amount: parseFloat(amount),
            userId,
            componentId: finalComponentId || PREMIUM_COMPONENT_ID // Usar premium como fallback
        };

        await prisma.donation.create({
            data: donationData
        });

        // Verificar si el usuario ahora tiene acceso premium
        const totalDonations = await prisma.donation.aggregate({
            where: { userId },
            _sum: { amount: true }
        });
        
        const newTotal = totalDonations._sum.amount || 0;
        const nowHasPremium = newTotal >= PREMIUM_THRESHOLD;

        // Redirigir a página de éxito con información
        const successUrl = `/payment-success.html?` + 
            `amount=${amount}&` +
            `currency=MXN&` +
            `isPremium=${nowHasPremium}&` +
            `componentId=${finalComponentId === PREMIUM_COMPONENT_ID ? '' : finalComponentId}&` +
            `total=${newTotal}`;

        res.redirect(successUrl);

    } catch (error) {
        console.error('Error capturing PayPal order:', error);
        res.redirect('/payment-error.html?error=' + encodeURIComponent(error.message));
    }
};

export const cancelOrder = (req, res) => {
    res.redirect('/payment-cancelled.html');
};

// Nuevo endpoint para obtener información de precios
export const getPricingInfo = async (req, res) => {
    try {
        const userId = req.user?.id;
        let userInfo = null;

        if (userId) {
            const totalDonations = await prisma.donation.aggregate({
                where: { userId },
                _sum: { amount: true }
            });
            
            userInfo = {
                totalDonated: totalDonations._sum.amount || 0,
                isPremium: (totalDonations._sum.amount || 0) >= PREMIUM_THRESHOLD,
                remainingForPremium: Math.max(0, PREMIUM_THRESHOLD - (totalDonations._sum.amount || 0))
            };
        }

        res.json({
            pricing: {
                premiumThreshold: PREMIUM_THRESHOLD,
                currency: 'MXN',
                freeAccessLimit: 2,
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
                approximateRate: USD_TO_MXN_RATE
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};