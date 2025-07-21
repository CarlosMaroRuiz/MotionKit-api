import { Router } from 'express';
import { register, login } from '../controllers/user.controller.js';

const router = Router();

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - pass
 *             properties:
 *               email:
 *                 type: string
 *                 description: User's email
 *                 example: user@example.com
 *               pass:
 *                 type: string
 *                 description: User's password
 *                 example: password123
 *     responses:
 *       200:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.post('/register', register);

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - pass
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               pass:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *       400:
 *         description: Invalid credentials or user not found
 *       500:
 *         description: Server error
 */
router.post('/login', login);

export default router;