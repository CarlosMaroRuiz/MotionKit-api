import { response } from "express";
import {
  HOST,
  PAYPAL_API_URL,
  PAYPAL_API_CLIENT,
  PAYPAL_API_SECRET,
} from "../config.js";
import axios from "axios";

export const createOrder = async (req, res) => {
  const order = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "USD",
          value: "9.99",
        },
      },
    ],
    application_context: {
      brand_name: "Mi tienda",
      landing_page: "NO_PREFERENCE",
      user_action: "PAY_NOW",
      return_url: `${HOST}/payment/capture-order`,
      cancel_url: `${HOST}/payment/cancel-order`,
    },
  };

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");

  const {
    data: { access_token },
  } = await axios.post(`${PAYPAL_API_URL}/v1/oauth2/token`, params, {
    auth: {
      username: PAYPAL_API_CLIENT,
      password: PAYPAL_API_SECRET,
    },
  });

  const orderdata = await axios.post(
    `${PAYPAL_API_URL}/v2/checkout/orders`,
    order,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
    }
  );

  console.log(orderdata.data);

  return res.json(orderdata.data);
};


export const captureOrder = async(req, res = response) => {

  const {token} = req.query

  const orderdata = await axios.post(`${PAYPAL_API_URL}/v2/checkout/orders/${token}/capture`, {}, {
    auth: {
      username: PAYPAL_API_CLIENT,
      password: PAYPAL_API_SECRET,
    },
  })

  console.log(orderdata.data);
  


  return res.send('pagado')
};


export const cancelOrder = (req, res = response) => res.redirect('/')