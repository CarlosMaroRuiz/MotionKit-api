import { Router } from "express";
import { cancelOrder, captureOrder, createOrder } from "../controllers/payment.controller.js";
import { authRequired } from "../middleware/auth.middleware.js";

const router = Router();

// Proteger la creación de la orden para asegurar que tenemos un userId
router.post("/create-order", authRequired, createOrder);

router.get("/capture-order", captureOrder);

router.get("/cancel-order", cancelOrder);

export default router;