import { Router } from 'express';
import { authRequired } from '../middleware/auth.middleware.js';
import { getComponents, createComponent, getComponent } from '../controllers/component.controller.js';

const router = Router();

/**
 * @swagger
 * /api/components:
 *   get:
 *     summary: Get a list of all components
 *     tags: [Components]
 *     responses:
 *       200:
 *         description: A list of components (without HTML code)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 */
router.get('/', getComponents);

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
 *               - html
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the component
 *               html:
 *                 type: string
 *                 description: HTML code for the component
 *     responses:
 *       200:
 *         description: The component was successfully created
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
 *         description: Component data (if user has donated)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 html:
 *                   type: string
 *       403:
 *         description: Access denied (user has not donated for this component)
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', authRequired, getComponent);

export default router;