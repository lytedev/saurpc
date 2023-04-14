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
    add(a: number, b: number) {
      return a + b;
    },
    report(score: number, goal: number, message: string | null) {
      return `Your score: ${score} of ${goal} -- ${message || "Thank you!"}`;
    },
  };

  const controller = new AbortController();
  const listener = serve(rpcs, { port: 27511, signal: controller.signal });

  const client = new Client<typeof rpcs>("http://localhost:27511");

  assertEquals(await client.call("sayHelloTo", ["World"]), "Hello, World");
  assertNotEquals(await client.call("sayHelloTo", ["World"]), "Hello, None");

  assertEquals(await client.call("add", [3, 4]), 7);
  assertNotEquals(await client.call("add", [3, 3]), 7);

  assertEquals(
    await client.call("report", [3, 4, "You're welcome!"]),
    "Your score: 3 of 4 -- You're welcome!",
  );
  assertNotEquals(
    await client.call("report", [3, 9, null]),
    "Your score: 7 of 9 -- Thank you!",
  );

  controller.abort();
  await listener;
});
