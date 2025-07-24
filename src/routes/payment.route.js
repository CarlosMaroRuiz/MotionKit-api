import { Router } from "express";
import { 
    cancelOrder, 
    captureOrder, 
    createOrder, 
    getPricingInfo 
} from "../controllers/payment.controller.js";
import { authRequired } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /api/payment/pricing-info:
 *   get:
 *     summary: Get pricing information and user status
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pricing information and user status
 */
router.get("/pricing-info", getPricingInfo);

/**
 * @swagger
 * /api/payment/create-order:
 *   get:
 *     summary: Create premium upgrade order (50 MXN predefined)
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: PayPal order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 link:
 *                   type: string
 *                   description: PayPal approval URL
 *                   example: "https://www.sandbox.paypal.com/checkoutnow?token=..."
 *       400:
 *         description: User already has premium access
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Error creating PayPal order
 *     description: |
 *       Creates a PayPal order for premium upgrade with predefined settings:
 *       - amount: 50.0 MXN (fixed)
 *       - isPremiumUpgrade: true (automatic)
 *       - No request body needed
 *       
 *       Simply call this GET endpoint and redirect user to the returned link.
 */
router.get("/create-order", authRequired, createOrder);

/**
 * @swagger
 * /api/payment/capture-order:
 *   get:
 *     summary: Capture the payment after PayPal approval
 *     tags: [Payment]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The token provided by PayPal after payment approval.
 *       - in: query
 *         name: componentId
 *         required: false
 *         schema:
 *           type: string
 *         description: The component ID (if applicable)
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: number
 *         description: The amount in MXN
 *       - in: query
 *         name: isPremiumUpgrade
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Whether this is a premium upgrade
 *     responses:
 *       302:
 *         description: Redirects to a success page after capturing payment and saving the donation.
 *       500:
 *         description: Error capturing order
 */
router.get("/capture-order", captureOrder);

/**
 * @swagger
 * /api/payment/cancel-order:
 *   get:
 *     summary: Handle cancelled PayPal payment
 *     tags: [Payment]
 *     responses:
 *       302:
 *         description: Redirects the user to a cancellation page.
 */
router.get("/cancel-order", cancelOrder);

export default router;