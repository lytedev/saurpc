import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import {
  assertEquals,
  assertNotEquals,
  assertRejects,
} from "https://deno.land/std@0.183.0/testing/asserts.ts";
import { handleProcedureCall } from "./server.ts";
import { buildRequestFor, callsFor, Client } from "./client.ts";

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
        return await handleProcedureCall(req, rpcs);
      } catch (err) {
        console.error(err);
        return new Response("{}", { status: 400 });
      }
    },
    { port: 24515, signal: ac.signal },
  );

  const client = new Client("http://127.0.0.1:24515", rpcs);

  assertEquals(
    await client.call("add", 8, 9),
    17,
  );

  // @ts-ignore: intentionally checking for server error
  await assertRejects(() => client.call("notReal", ["yo"]));

  assertEquals(await client.call("ping"), "pong");
  assertEquals(await client.calls.ping(), "pong");
  assertNotEquals(await client.calls.ping(), "ack");

  assertEquals(await client.calls.sayHelloTo("World"), "Hello, World");
  assertNotEquals(await client.calls.sayHelloTo("World"), "Hello, None");

  assertEquals(await client.call("add", 3, 4), 7);
  assertNotEquals(await client.call("add", 3, 3), 7);

  assertEquals(
    await client.call("report", 3, 4, "You're welcome!"),
    "Your score: 3 of 4 -- You're welcome!",
  );
  assertNotEquals(
    await client.call("report", 3, 9, null),
    "Your score: 7 of 9 -- Thank you!",
  );

  ac.abort();
  await listener;
});

Deno.test("request/response RPCs work as expected", async () => {
  const calls = callsFor(rpcs);

  assertRejects(() =>
    handleProcedureCall(
      buildRequestFor("file:///dev/null", "not real", []),
      rpcs,
    )
  );
  const ping = calls.ping;

  assertEquals(await ping(), "Hello, World");

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
