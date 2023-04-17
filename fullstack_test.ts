import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import {
  assertEquals,
  assertNotEquals,
  assertRejects,
} from "https://deno.land/std@0.183.0/testing/asserts.ts";
import { handleProcedureCall } from "./server.ts";
import { buildRequestFor, Client } from "./client.ts";
import { buildCall } from "./testing.ts";

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

Deno.test("basic server and client RPCs work as expected", async () => {
  const ac = new AbortController();

  const listener = serve(
    async (req: Request) => {
      try {
        return await handleProcedureCall(req, rpcs);
      } catch (err) {
        console.error(err);
        return err;
      }
    },
    { port: 24515, signal: ac.signal },
  );

  const client = new Client("http://127.0.0.1:24515");
  const call = client.call.bind(client);

  assertRejects(() => call("notReal", ["yo"]));

  assertEquals(await call("sayHelloTo", ["World"]), "Hello, World");
  assertNotEquals(await call("sayHelloTo", ["World"]), "Hello, None");

  assertEquals(await call("add", [3, 4]), 7);
  assertNotEquals(await call("add", [3, 3]), 7);

  assertEquals(
    await call("report", [3, 4, "You're welcome!"]),
    "Your score: 3 of 4 -- You're welcome!",
  );
  assertNotEquals(
    await call("report", [3, 9, null]),
    "Your score: 7 of 9 -- Thank you!",
  );

  ac.abort();
  await listener;
});

Deno.test("request/response RPCs work as expected", async () => {
  const call = buildCall(rpcs);

  assertRejects(() =>
    handleProcedureCall(
      buildRequestFor("file:///dev/null", "not real", []),
      rpcs,
    )
  );

  assertEquals(await call("sayHelloTo", ["World"]), "Hello, World");
  assertNotEquals(await call("sayHelloTo", ["World"]), "Hello, None");

  assertEquals(await call("add", [3, 4]), 7);
  assertNotEquals(await call("add", [3, 3]), 7);

  assertEquals(
    await call("report", [3, 4, "You're welcome!"]),
    "Your score: 3 of 4 -- You're welcome!",
  );
  assertNotEquals(
    await call("report", [3, 9, null]),
    "Your score: 7 of 9 -- Thank you!",
  );
});
