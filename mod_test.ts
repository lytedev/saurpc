import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.183.0/testing/asserts.ts";
import { genCalls, genLocalCalls, handleRpcRequest } from "./mod.ts";

const rpcs = {
  ping() {
    return `pong`;
  },
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

Deno.test("basic server and client RPCs work as expected", async () => {
  const ac = new AbortController();

  const listener = serve(
    async (req: Request) => {
      try {
        return await handleRpcRequest(req, rpcs);
      } catch (err) {
        console.error(err);
        return new Response("{}", { status: 400 });
      }
    },
    { port: 24515, signal: ac.signal },
  );

  const client = genCalls<typeof rpcs>(
    Object.keys(rpcs) as (keyof typeof rpcs)[],
    "http://127.0.0.1:24515",
  );

  assertEquals(
    await client.add(8, 9),
    17,
  );

  assertEquals(await client.ping(), "pong");
  assertEquals(await client.ping(), "pong");
  assertNotEquals(await client.ping(), "ack");

  assertEquals(await client.sayHelloTo("World"), "Hello, World");
  assertNotEquals(await client.sayHelloTo("World"), "Hello, None");

  assertEquals(await client.add(3, 4), 7);
  assertNotEquals(await client.add(3, 3), 7);

  assertEquals(
    await client.report(3, 4, "You're welcome!"),
    "Your score: 3 of 4 -- You're welcome!",
  );
  assertNotEquals(
    await client.report(3, 9, null),
    "Your score: 7 of 9 -- Thank you!",
  );

  ac.abort();
  await listener;
});

Deno.test("request/response RPCs work as expected", async () => {
  const calls = genLocalCalls(rpcs);

  assertEquals(await calls.ping(), "pong");

  assertEquals(await calls.sayHelloTo("World"), "Hello, World");
  assertNotEquals(await calls.sayHelloTo("World"), "Hello, None");

  assertEquals(await calls.add(3, 4), 7);
  assertNotEquals(await calls.add(3, 3), 7);

  assertEquals(
    await calls.report(3, 4, "You're welcome!"),
    "Your score: 3 of 4 -- You're welcome!",
  );
  assertNotEquals(
    await calls.report(3, 9, null),
    "Your score: 7 of 9 -- Thank you!",
  );
});
