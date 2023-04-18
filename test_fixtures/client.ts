import { MyRpcs } from "./common.ts";
import { genCalls } from "../mod.ts";

const client = genCalls<MyRpcs>(
  ["ping", "sayHelloTo", "add", "report"],
  "http://127.0.0.1:24515",
);

console.log(client.ping());
