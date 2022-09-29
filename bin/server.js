import { createServer } from "http";
import app from "../src/app.js";

const port = process.env.PORT || 3000;

const server = createServer(app);
server.listen(port);
console.log('Listening on '+port)