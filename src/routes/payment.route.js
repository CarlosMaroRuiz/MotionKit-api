import { Router } from "express";
import { cancelOrder, captureOrder, createOrder } from "../controllers/payment.controller.js";
import { authRequired } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * /api/payment/create-order:
 *   post:
 *     summary: Create a PayPal order for a donation
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
 *               - componentId
 *             properties:
 *               amount:
 *                 type: number
 *                 format: float
 *                 description: The amount to donate
 *               componentId:
 *                 type: string
 *                 description: The ID of the component to donate to
 *     responses:
 *       200:
 *         description: PayPal order created. Returns approval link.
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
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: number
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
 *         description: Redirects the user back to the home page.
 */
router.get("/cancel-order", cancelOrder);

export default router;