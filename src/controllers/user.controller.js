import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export const register = async (req, res) => {
    const { email, pass } = req.body;
    try {
        const passHash = await bcrypt.hash(pass, 10);
        const newUser = await prisma.user.create({
            data: {
                email,
                pass: passHash,
            },
        });
        res.json({ id: newUser.id, email: newUser.email });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const login = async (req, res) => {
    const { email, pass } = req.body;
    try {
        const userFound = await prisma.user.findUnique({ where: { email } });
        if (!userFound) return res.status(400).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(pass, userFound.pass);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: userFound.id }, 'secret123', { expiresIn: '1d' });

        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};