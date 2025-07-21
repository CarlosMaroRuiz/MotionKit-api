import { PrismaClient } from '@prisma/client';
import { HOST, PAYPAL_API_URL, PAYPAL_API_CLIENT, PAYPAL_API_SECRET } from '../config.js';
import axios from 'axios';

const prisma = new PrismaClient();

export const createOrder = async (req, res) => {
    const { amount, componentId } = req.body;

    if (parseFloat(amount) <= 0) {
        return res.status(400).json({ message: 'Donation amount must be greater than 0.' });
    }

    const order = {
        intent: 'CAPTURE',
        purchase_units: [{
            amount: {
                currency_code: 'USD',
                value: parseFloat(amount).toFixed(2),
            },
        }],
        application_context: {
            brand_name: 'Component Store',
            landing_page: 'NO_PREFERENCE',
            user_action: 'PAY_NOW',
            // Pasamos los datos que necesitaremos después en la URL de retorno
            return_url: `${HOST}/api/payment/capture-order?componentId=${componentId}&userId=${req.user.id}&amount=${amount}`,
            cancel_url: `${HOST}/api/payment/cancel-order`,
        },
    };

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    try {
        const { data: { access_token } } = await axios.post(`${PAYPAL_API_URL}/v1/oauth2/token`, params, {
            auth: { username: PAYPAL_API_CLIENT, password: PAYPAL_API_SECRET },
        });

        const orderResponse = await axios.post(`${PAYPAL_API_URL}/v2/checkout/orders`, order, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${access_token}`,
            },
        });
        
        res.json(orderResponse.data);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error creating PayPal order" });
    }
};

export const captureOrder = async (req, res) => {
    const { token, componentId, userId, amount } = req.query;

    try {
        await axios.post(`${PAYPAL_API_URL}/v2/checkout/orders/${token}/capture`, {}, {
            auth: { username: PAYPAL_API_CLIENT, password: PAYPAL_API_SECRET },
        });

        // Guardar la donación en la base de datos
        await prisma.donation.create({
            data: {
                amount: parseFloat(amount),
                userId,
                componentId,
            },
        });

        // Redirigir a una página de éxito
        res.redirect('/payment-success.html');

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error capturing PayPal order" });
    }
};

export const cancelOrder = (req, res) => res.redirect('/');