import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.apiPort, () => {
  console.log(`GSR API listening on port ${env.apiPort}`);
});
