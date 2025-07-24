import { Router } from "express";
import { 
    cancelOrder, 
    captureOrder, 
    createOrder, 
    getPricingInfo,
    getOrderStatus
} from "../controllers/payment.controller.js";
import { authRequired, authOptional } from "../middleware/auth.middleware.js";
import {
    validateCreateOrder,
    validateCaptureOrder,
    validateOrderStatus,
    validatePayPalConfig,
    checkPremiumStatus,
    validateComponentAccess,
    paymentRateLimit,
    sanitizeResponse
} from "../middleware/payment.validation.js";

const router = Router();

// Aplicar middleware global para sanitizar respuestas
router.use(sanitizeResponse);

// Aplicar validación de configuración de PayPal a todas las rutas de pago
router.use(['/create-order', '/capture-order', '/order-status/:orderId'], validatePayPalConfig);

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
 *         description: Pricing information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     pricing:
 *                       type: object
 *                       properties:
 *                         premiumThreshold:
 *                           type: number
 *                           example: 50
 *                         currency:
 *                           type: string
 *                           example: "MXN"
 *                         freeAccessLimit:
 *                           type: number
 *                           example: 2
 *                         minimumDonation:
 *                           type: number
 *                           example: 1
 *                         premiumBenefits:
 *                           type: array
 *                           items:
 *                             type: string
 *                     user:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         totalDonated:
 *                           type: number
 *                         currency:
 *                           type: string
 *                         isPremium:
 *                           type: boolean
 *                         remainingForPremium:
 *                           type: number
 *                         donationHistory:
 *                           type: array
 *                           items:
 *                             type: object
 *                     exchangeRate:
 *                       type: object
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Server error
 */
router.get("/pricing-info", authOptional, getPricingInfo);

/**
 * @swagger
 * /api/payment/create-order:
 *   post:
 *     summary: Create a PayPal payment order with comprehensive validation
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
 *                 minimum: 1
 *                 maximum: 10000
 *                 description: Amount in Mexican Pesos (1-10000 MXN)
 *                 example: 25.50
 *               componentId:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 100
 *                 description: ID of component to unlock (must exist in database)
 *                 example: "custom-button-1"
 *               isPremiumUpgrade:
 *                 type: boolean
 *                 default: false
 *                 description: Whether this is a premium upgrade purchase
 *                 example: false
 *     responses:
 *       201:
 *         description: PayPal order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "PayPal order created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: string
 *                       description: PayPal order ID
 *                     status:
 *                       type: string
 *                       description: Order status
 *                     approvalUrl:
 *                       type: string
 *                       description: URL to redirect user for payment approval
 *                     amount:
 *                       type: object
 *                       properties:
 *                         mxn:
 *                           type: number
 *                         usd:
 *                           type: number
 *                     componentId:
 *                       type: string
 *                       nullable: true
 *                     isPremiumUpgrade:
 *                       type: boolean
 *                     links:
 *                       type: array
 *                       items:
 *                         type: object
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation errors or business logic violations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                       message:
 *                         type: string
 *                       value:
 *                         type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Component not found
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many payment attempts (rate limited)
 *       500:
 *         description: PayPal API error or server error
 *     description: |
 *       Creates a PayPal payment order with comprehensive validation:
 *       
 *       **Validations Applied:**
 *       - Amount: 1-10000 MXN range
 *       - Component ID: Must exist in database (if provided)
 *       - Premium upgrade: Validates sufficient amount for premium threshold
 *       - User status: Prevents duplicate premium upgrades or component access
 *       - Rate limiting: Max 10 attempts per 5 minutes per user
 *       
 *       **Business Rules:**
 *       - Premium upgrade requires total donations ≥ 50 MXN
 *       - Cannot purchase access to already accessible components
 *       - Premium users cannot purchase individual components
 */
router.post("/create-order", 
    authRequired, 
    paymentRateLimit,
    validateCreateOrder,
    checkPremiumStatus,
    validateComponentAccess,
    createOrder
);

/**
 * @swagger
 * /api/payment/capture-order:
 *   get:
 *     summary: Capture PayPal payment with full validation (webhook endpoint)
 *     tags: [Payment]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 10
 *           maxLength: 200
 *         description: PayPal order token from approval process
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Valid user UUID who made the payment
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 10000
 *         description: Payment amount in MXN (1-10000)
 *       - in: query
 *         name: componentId
 *         required: false
 *         schema:
 *           type: string
 *           maxLength: 100
 *         description: Component ID (validated if provided)
 *       - in: query
 *         name: isPremiumUpgrade
 *         required: false
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Whether this is a premium upgrade
 *     responses:
 *       200:
 *         description: Payment captured and processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Payment completed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentInfo:
 *                       type: object
 *                       properties:
 *                         orderId:
 *                           type: string
 *                         paypalTransactionId:
 *                           type: string
 *                         amount:
 *                           type: object
 *                           properties:
 *                             paid:
 *                               type: number
 *                             currency:
 *                               type: string
 *                         paymentDate:
 *                           type: string
 *                           format: date-time
 *                         status:
 *                           type: string
 *                     userStatus:
 *                       type: object
 *                       properties:
 *                         totalDonated:
 *                           type: number
 *                         currency:
 *                           type: string
 *                         isPremium:
 *                           type: boolean
 *                         wasUpgradedToPremium:
 *                           type: boolean
 *                         premiumThreshold:
 *                           type: number
 *                     componentAccess:
 *                       type: object
 *                       properties:
 *                         componentId:
 *                           type: string
 *                           nullable: true
 *                         isPremiumUpgrade:
 *                           type: boolean
 *                         accessGranted:
 *                           type: boolean
 *                     donation:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         amount:
 *                           type: number
 *                         isNewDonation:
 *                           type: boolean
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation errors or PayPal payment not completed
 *       500:
 *         description: Error processing payment
 *     description: |
 *       Captures and processes PayPal payment with comprehensive validation:
 *       
 *       **Validations Applied:**
 *       - PayPal token format and validity
 *       - User ID format (UUID) and existence in database
 *       - Amount range (1-10000 MXN)
 *       - Component ID format and existence (if provided)
 *       - PayPal payment completion status
 *       
 *       **Processing Steps:**
 *       1. Validates all input parameters
 *       2. Captures payment with PayPal API
 *       3. Verifies payment completion status
 *       4. Saves/updates donation in database
 *       5. Recalculates user premium status
 *       6. Returns comprehensive payment result
 */
router.get("/capture-order", validateCaptureOrder, captureOrder);

/**
 * @swagger
 * /api/payment/cancel-order:
 *   get:
 *     summary: Handle PayPal payment cancellation (webhook endpoint)
 *     tags: [Payment]
 *     responses:
 *       200:
 *         description: Payment cancellation acknowledged
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Payment was cancelled by user"
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "cancelled"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *     description: |
 *       Handles PayPal payment cancellation. Returns structured JSON response
 *       instead of redirecting to HTML page. No validation required as this
 *       endpoint simply acknowledges the cancellation.
 */
router.get("/cancel-order", cancelOrder);

/**
 * @swagger
 * /api/payment/order-status/{orderId}:
 *   get:
 *     summary: Get PayPal order status with validation
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 10
 *           maxLength: 50
 *         description: Valid PayPal order ID
 *     responses:
 *       200:
 *         description: Order status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: ['CREATED', 'SAVED', 'APPROVED', 'VOIDED', 'COMPLETED', 'PAYER_ACTION_REQUIRED']
 *                     createTime:
 *                       type: string
 *                       format: date-time
 *                     updateTime:
 *                       type: string
 *                       format: date-time
 *                     amount:
 *                       type: object
 *                     links:
 *                       type: array
 *                       items:
 *                         type: object
 *                     userId:
 *                       type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid order ID format
 *       404:
 *         description: Order not found in PayPal
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: PayPal API error
 *     description: |
 *       Retrieves PayPal order status with validation:
 *       
 *       **Validations Applied:**
 *       - Order ID format (10-50 characters)
 *       - User authentication
 *       - PayPal API connectivity
 *       
 *       **Use Cases:**
 *       - Check payment status during processing
 *       - Debug payment issues
 *       - Verify order completion
 *       - Monitor payment flow
 */
router.get("/order-status/:orderId", authRequired, validateOrderStatus, getOrderStatus);

export default router;