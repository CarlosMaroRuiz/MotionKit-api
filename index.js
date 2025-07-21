import express from 'express';
import path from 'path';
import { HOST, PORT } from './src/config.js';

// Importa las rutas
import paymentRoute from './src/routes/payment.route.js';
import userRoute from './src/routes/user.route.js';
import componentRoute from './src/routes/component.route.js';

// Importa Swagger
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger.js';

const app = express();

app.use(express.json());
app.use(express.static(path.resolve('src/public')));

// Ruta para la documentación de la API
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rutas de la API
app.use('/api/payment', paymentRoute);
app.use('/api/users', userRoute);
app.use('/api/components', componentRoute);

app.listen(PORT, () => {
    console.log(`Server running on ${HOST}`);
    console.log(`API Docs available at ${HOST}/api-docs`);
});