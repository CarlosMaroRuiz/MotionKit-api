import { Router } from 'express';
import { authRequired } from '../middleware/auth.middleware.js';
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
 *           nullable: true
 *           description: Component ID (can be null for auto-generated)
 *         name:
 *           type: string
 *           description: Name of the component
 *         jsxCode:
 *           type: string
 *           description: JSX code for the component
 *         type:
 *           type: string
 *           description: Type/category of the component
 *         animationCode:
 *           type: string
 *           nullable: true
 *           description: Animation code for the component (optional)
 *     ComponentSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         type:
 *           type: string
 *     SearchResults:
 *       type: object
 *       properties:
 *         results:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ComponentSummary'
 *         count:
 *           type: number
 *         filters:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               nullable: true
 *             id:
 *               type: string
 *               nullable: true
 *             name:
 *               type: string
 *               nullable: true
 */

/**
 * @swagger
 * /api/components:
 *   get:
 *     summary: Get a list of all components
 *     tags: [Components]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter components by type
 *     responses:
 *       200:
 *         description: A list of components (without JSX code)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ComponentSummary'
 */
router.get('/', getComponents);

/**
 * @swagger
 * /api/components/search:
 *   get:
 *     summary: Search components by multiple criteria
 *     tags: [Components]
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
 *         description: Search by exact component ID (unique identifier - returns single object)
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Search by component name (supports partial matching)
 *       - in: query
 *         name: single
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: If 'true', returns single object instead of array when only one result found
 *     responses:
 *       200:
 *         description: Search results - returns single object when searching by ID, array otherwise
 *         content:
 *           application/json:
 *             oneOf:
 *               - $ref: '#/components/schemas/SearchResults'
 *               - $ref: '#/components/schemas/ComponentSummary'
 *       404:
 *         description: Component not found (when searching by specific ID or no results match criteria)
 *       500:
 *         description: Server error
 *     examples:
 *       search_by_exact_id:
 *         summary: Get component by exact ID (returns single object)
 *         value:
 *           id: "button-magnetic-5"
 *       search_by_type_and_id:
 *         summary: Get component by type and exact ID (returns single object)
 *         value:
 *           type: "button"
 *           id: "button-magnetic-5"
 *       search_by_name:
 *         summary: Search components with "modal" in name (returns array)
 *         value:
 *           name: "modal"
 */
router.get('/search', authRequired ,searchComponents);

/**
 * @swagger
 * /api/components/type/{type}:
 *   get:
 *     summary: Get components filtered by type
 *     tags: [Components]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: The component type to filter by
 *     responses:
 *       200:
 *         description: Components of the specified type
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ComponentSummary'
 *       400:
 *         description: Type parameter is required
 */
router.get('/type/:type', getComponentsByType);

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
 *         description: Access denied (user needs premium access or specific donation)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 component:
 *                   $ref: '#/components/schemas/ComponentSummary'
 *                 premiumInfo:
 *                   type: object
 *                   properties:
 *                     totalNeeded:
 *                       type: number
 *                     currency:
 *                       type: string
 *                     benefits:
 *                       type: string
 *       404:
 *         description: Component not found with specified type and ID
 *       401:
 *         description: Unauthorized
 */
router.get('/type/:type/id/:id', authRequired, getComponentByTypeAndId);

/**
 * @swagger
 * /api/components/user/access-info:
 *   get:
 *     summary: Get user access information
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
 *                     currency:
 *                       type: string
 *                     isPremium:
 *                       type: boolean
 *                     premiumThreshold:
 *                       type: number
 *                     freeAccessLimit:
 *                       type: number
 *                 access:
 *                   type: object
 *                   properties:
 *                     totalAccessibleComponents:
 *                       type: number
 *                     accessibleComponentIds:
 *                       type: array
 *                       items:
 *                         type: string
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
 *                 description: Type/category of the component (e.g., button, card, modal)
 *               animationCode:
 *                 type: string
 *                 nullable: true
 *                 description: Optional animation code for the component
 *     responses:
 *       201:
 *         description: The component was successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Component'
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Component with this ID already exists
 *       401:
 *         description: Unauthorized (token is missing or invalid)
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
 *         description: Access denied (user needs premium access or specific donation)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 component:
 *                   $ref: '#/components/schemas/ComponentSummary'
 *                 premiumInfo:
 *                   type: object
 *                   properties:
 *                     totalNeeded:
 *                       type: number
 *                     currency:
 *                       type: string
 *                     benefits:
 *                       type: string
 *       404:
 *         description: Component not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', authRequired, getComponent);

export default router;