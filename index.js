import express from 'express';
import path from 'path';
import { HOST, PORT } from './src/config.js';
import paymentRoute from './src/routes/payment.route.js';
import userRoute from './src/routes/user.route.js';
import componentRoute from './src/routes/component.route.js';

const app = express();

app.use(express.json());
app.use(express.static(path.resolve('src/public')));

// Rutas
app.use('/api/payment', paymentRoute);
app.use('/api/users', userRoute);
app.use('/api/components', componentRoute);

app.listen(PORT, () => {
    console.log(`Server running on ${HOST}`);
});