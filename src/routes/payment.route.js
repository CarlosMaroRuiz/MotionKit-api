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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pricing:
 *                   type: object
 *                   properties:
 *                     premiumThreshold:
 *                       type: number
 *                       description: Amount needed for premium access (in MXN)
 *                     currency:
 *                       type: string
 *                     freeAccessLimit:
 *                       type: number
 *                     premiumBenefits:
 *                       type: array
 *                       items:
 *                         type: string
 *                 user:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     totalDonated:
 *                       type: number
 *                     isPremium:
 *                       type: boolean
 *                     remainingForPremium:
 *                       type: number
 *                 exchangeRate:
 *                   type: object
 *                   properties:
 *                     note:
 *                       type: string
 *                     approximateRate:
 *                       type: number
 */
router.get("/pricing-info", getPricingInfo);

/**
 * @swagger
 * /api/payment/create-order:
 *   post:
 *     summary: Create a PayPal order for a donation or premium upgrade
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 format: float
 *                 description: The amount to donate (in MXN)
 *               componentId:
 *                 type: string
 *                 nullable: true
 *                 description: The ID of the component to donate to (null for premium upgrade)
 *               isPremiumUpgrade:
 *                 type: boolean
 *                 description: Whether this is a premium upgrade payment
 *     responses:
 *       200:
 *         description: PayPal order created. Returns approval link and metadata.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 status:
 *                   type: string
 *                 links:
 *                   type: array
 *                   items:
 *                     type: object
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     amountMXN:
 *                       type: string
 *                     amountUSD:
 *                       type: string
 *                     isPremiumUpgrade:
 *                       type: boolean
 *                     componentId:
 *                       type: string
 *                       nullable: true
 *       400:
 *         description: Invalid request (amount <= 0, user already premium, etc.)
 *       404:
 *         description: Component not found
 *       401:
 *         description: Unauthorized
 */
router.post("/create-order", authRequired, createOrder);

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