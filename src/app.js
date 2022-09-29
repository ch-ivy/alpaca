"use strict";

import createError from "http-errors";
import serverless from "serverless-http";
import express, { Router } from "express";
import logger from "morgan";
import pkg from "body-parser";
const { json, urlencoded } = pkg;

const router = Router();

import bar from "./routes/bars.js";


const app = express();

app.use(logger("dev"));
app.use(json());
app.use(urlencoded({ extended: false }));

// CORS
app.use((req, res, next) => {
   res.header("Access-Control-Allow-Headers", "*");
   res.header("Access-Control-Allow-Origin", "*");

   if (req.method === "OPTION") {
      res.header(
         "Access-Control-Allow-Mehtods",
         "PUT, POST, PATCH, DELETE, GET"
      );
      return res.status(200).json({});
   }
   next();
});

router.get("/", (req, res) => {
   res.json({
      status: "true",
      message: "Hello",
   });
});

//middleware
app.use("/api", router);
app.use("/api/bar", bar);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
   next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
   // set locals, only providing error in development
   res.locals.message = err.message;
   res.locals.error = req.app.get("env") === "development" ? err : {};

   // render the error page
   res.status(err.status || 500);
   res.render("error");
});

export default app;
export const handler = serverless(app);
