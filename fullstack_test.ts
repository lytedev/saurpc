import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.183.0/testing/asserts.ts";
import { serve } from "./server.ts";
import { Client } from "./client.ts";

Deno.test("RPCs successfully with example code", async () => {
  const rpcs = {
    sayHelloTo(a: string) {
      return `Hello, ${a}`;
    },
  };

  const controller = new AbortController();
  const listener = serve(rpcs, { port: 27511, signal: controller.signal });

  const client = new Client<typeof rpcs>("http://localhost:27511");

  assertEquals(await client.call("sayHelloTo", ["World"]), "Hello, World");
  assertNotEquals(await client.call("sayHelloTo", ["World"]), "Hello, None");

  controller.abort();
  await listener;
});
