import swaggerJSDoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Component Store API',
      version: '1.0.0',
      description: 'API for managing users, components, and PayPal donations.',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT', // Opcional, pero bueno para la documentación
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // La ruta a los archivos que contienen las definiciones de la API
  apis: ['./src/routes/*.js'],
};

export const swaggerSpec = swaggerJSDoc(options);