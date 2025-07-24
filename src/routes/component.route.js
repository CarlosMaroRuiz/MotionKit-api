import { Router } from 'express';
import { authRequired, authOptional } from '../middleware/auth.middleware.js';
import { 
    getComponents, 
    createComponent, 
    getComponent, 
    getComponentsByType,
    getUserAccessInfo,
    searchComponents,
    getComponentByTypeAndId
} from '../controllers/component.controller.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Component:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Component ID
 *         name:
 *           type: string
 *           description: Name of the component
 *         jsxCode:
 *           type: string
 *           nullable: true
 *           description: JSX code for the component (null if no access)
 *         type:
 *           type: string
 *           description: Type/category of the component
 *         animationCode:
 *           type: string
 *           nullable: true
 *           description: Animation code for the component (null if no access or not provided)
 *     ComponentSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         type:
 *           type: string
 */

/**
 * @swagger
 * /api/components:
 *   get:
 *     summary: Get a list of all components (public info only)
 *     tags: [Components]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter components by type
 *     responses:
 *       200:
 *         description: A list of components (basic info only, no sensitive code)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ComponentSummary'
 *     description: |
 *       Returns basic component information (id, name, type) for all components.
 *       Does NOT include jsxCode or animationCode for security reasons.
 *       Use authenticated endpoints to get complete component data.
 */
router.get('/', getComponents);

/**
 * @swagger
 * /api/components/search:
 *   get:
 *     summary: Search components by multiple criteria (requires authentication)
 *     tags: [Components]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by component type
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Search by exact component ID
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Search by component name (partial matching)
 *       - in: query
 *         name: single
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Return single object instead of array when only one result
 *     responses:
 *       200:
 *         description: Search results with access-controlled data
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Component'
 *                     count:
 *                       type: number
 *                     filters:
 *                       type: object
 *                 - $ref: '#/components/schemas/Component'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No components found
 *     description: |
 *       Returns components based on search criteria. If user doesn't have access to a component,
 *       jsxCode and animationCode will be null in the response.
 */
router.get('/search', authRequired, searchComponents);

/**
 * @swagger
 * /api/components/type/{type}:
 *   get:
 *     summary: Get components filtered by type (authentication optional)
 *     tags: [Components]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: The component type to filter by
 *       - in: header
 *         name: token
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional authentication token for full access
 *     responses:
 *       200:
 *         description: Components of the specified type
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Component'
 *       400:
 *         description: Type parameter is required
 *     description: |
 *       If authenticated, returns components with access-controlled data.
 *       If not authenticated, returns only basic info (jsxCode and animationCode will be null).
 */
router.get('/type/:type', authOptional, getComponentsByType);

/**
 * @swagger
 * /api/components/type/{type}/id/{id}:
 *   get:
 *     summary: Get a specific component by type and ID
 *     tags: [Components]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: The component type
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The component ID
 *     responses:
 *       200:
 *         description: Component data (if user has access)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Component'
 *       403:
 *         description: Access denied (jsxCode and animationCode are null)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 component:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     type:
 *                       type: string
 *                     jsxCode:
 *                       type: null
 *                     animationCode:
 *                       type: null
 *                 premiumInfo:
 *                   type: object
 *       404:
 *         description: Component not found
 *       401:
 *         description: Unauthorized
 */
router.get('/type/:type/id/:id', authRequired, getComponentByTypeAndId);

/**
 * @swagger
 * /api/components/user/access-info:
 *   get:
 *     summary: Get user access information and statistics
 *     tags: [Components]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User access information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     totalDonated:
 *                       type: number
 *                       description: Total amount donated by user
 *                     currency:
 *                       type: string
 *                       example: "MXN"
 *                     isPremium:
 *                       type: boolean
 *                       description: Whether user has premium access
 *                     premiumThreshold:
 *                       type: number
 *                       description: Amount needed for premium access
 *                     freeAccessLimit:
 *                       type: number
 *                       description: Number of free components available
 *                 access:
 *                   type: object
 *                   properties:
 *                     totalAccessibleComponents:
 *                       type: number
 *                       description: Total number of components user can access
 *                     accessibleComponentIds:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: List of component IDs user can access
 *       401:
 *         description: Unauthorized
 */
router.get('/user/access-info', authRequired, getUserAccessInfo);

/**
 * @swagger
 * /api/components:
 *   post:
 *     summary: Create a new component
 *     tags: [Components]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - jsxCode
 *               - type
 *             properties:
 *               id:
 *                 type: string
 *                 nullable: true
 *                 description: Optional custom ID for the component
 *               name:
 *                 type: string
 *                 description: Name of the component
 *               jsxCode:
 *                 type: string
 *                 description: JSX code for the component
 *               type:
 *                 type: string
 *                 description: Type/category of the component
 *               animationCode:
 *                 type: string
 *                 nullable: true
 *                 description: Optional animation code for the component
 *     responses:
 *       201:
 *         description: Component created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Component'
 *       400:
 *         description: Invalid input data or reserved ID
 *       409:
 *         description: Component with this ID already exists
 *       401:
 *         description: Unauthorized
 */
router.post('/', authRequired, createComponent);

/**
 * @swagger
 * /api/components/{id}:
 *   get:
 *     summary: Get a specific component's details
 *     tags: [Components]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The component ID
 *     responses:
 *       200:
 *         description: Component data (if user has access)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Component'
 *       403:
 *         description: Access denied - user needs to pay or upgrade
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Access denied. You need premium access or donate for this component."
 *                 component:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     type:
 *                       type: string
 *                     jsxCode:
 *                       type: null
 *                       description: "Null because user doesn't have access"
 *                     animationCode:
 *                       type: null
 *                       description: "Null because user doesn't have access"
 *                 premiumInfo:
 *                   type: object
 *                   properties:
 *                     totalNeeded:
 *                       type: number
 *                       example: 50
 *                     currency:
 *                       type: string
 *                       example: "MXN"
 *                     benefits:
 *                       type: string
 *                       example: "Unlock entire catalog"
 *       404:
 *         description: Component not found
 *       401:
 *         description: Unauthorized
 *     description: |
 *       Returns complete component data if user has access (premium or specific donation).
 *       If no access, returns component info with jsxCode and animationCode set to null.
 */
router.get('/:id', authRequired, getComponent);

export default router;