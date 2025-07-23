import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getComponents = async (req, res) => {
    const components = await prisma.component.findMany({
        select: { id: true, name: true } // No enviamos el HTML
    });
    res.json(components);
};

export const createComponent = async (req, res) => {
    const { name, html } = req.body;
    const newComponent = await prisma.component.create({
        data: {
            name,
            html
        },
    });
    res.json(newComponent);
};

export const getComponent = async (req, res) => {
    const { id } = req.params;

    // Verificar si el usuario ha donado para este componente
    const donation = await prisma.donation.findFirst({
        where: {
            componentId: id,
            userId: req.user.id,
        },
    });

    if (!donation) {
        const component = await prisma.component.findUnique({
             where: { id },
             select: { id: true, name: true }
        });
        return res.status(403).json({ 
            message: 'Access denied. You need to donate to see the code.',
            component
        });
    }

    const component = await prisma.component.findUnique({ where: { id } });
    res.json(component);
};