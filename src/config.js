import dotenv from "dotenv";
dotenv.config();

export const PORT = process.env.PORT;
export const PAYPAL_API_CLIENT = process.env.PAYPAL_API_CLIENT;
export const PAYPAL_API_SECRET = process.env.PAYPAL_API_SECRET;
export const HOST = process.env.HOST + ":"+ PORT;
export const PAYPAL_API_URL = "https://api.sandbox.paypal.com";