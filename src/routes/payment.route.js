import { Router } from "express";
import {
  cancelOrder,
  captureOrder,
  createOrder,
} from "../controllers/payment.controller.js";

const router = Router();

router.post("/create-order", createOrder);

router.get("/capture-order", captureOrder);

router.get("/cancel-order",cancelOrder );


router.get("/prueba", (req, res) =>
  res.json({ message: "hola", ok: true, status: 200, data: "hola" })
);

export default router;
