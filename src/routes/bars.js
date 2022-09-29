import fetch from "node-fetch";
import { Router } from "express";


const router = Router();

router.get("/", async (req, res, next) => {


   res.status(200).json({
      status: 'success',
      data: null
   });



});

router.post("/", async (req, res, next) => {

   const symbol = req.body.symbol;
   const start = req.body.start;
   const end = req.body.end;
   const timeframe = req.body.timeframe;
   const limit = req.body.limit;
   const currency = req.body.currency;
   const feed = req.body.feed;
   const asof = req.body.asof;
   const adjustment = req.body.adjustment;
   const page_token = req.body.page_token;


   if (!symbol || !timeframe) {
      return res.status(500).json({
         status: "error",
         message: 'Symbol and Timeframe are required parameters'
      })

   }

   let url = `https://data.sandbox.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=${timeframe}`;


   if (start) {
      url += `&start=${new Date(start)}`;
   }

   if (end) {
      url += `&end=${new Date(end)}`
   }

   if (limit) {
      url += `&limit=${limit}`
   }

   if (currency) {
      url += `&currency=${currency}`
   }

   if (feed) {
      url += `&feed=${feed}`
   }

   if (asof) {
      url += `&asof=${asof}`
   }

   if (adjustment) {
      url += `&adjustment=${adjustment}`
   }

   if (page_token) {
      url += `&page_token=${page_token}`
   }



   // Please replace Authorization header key with `Basic $Alpaca_key:$Alpaca_secret` to get correct authorization


   await fetch(url, {
      method: 'GET',
      headers: {
         "Authorization": `Basic CKR6VC0O46D70Z8144WY:K3VdR8z8jxK2yn4RspGpXxOHqNZR3q81V5gIZlsR`,
         'Access-Control-Allow-Origin': '*'
      }
   }).then((data) => {
      res.status(201).json({
         status: 'success',
         data
      });
   }).catch((err) => {
      res.status(500).json({
         status: "error",
         error: err
      })
   })
})

export default router;
