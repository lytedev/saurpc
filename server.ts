import {
  Application,
  Context,
  ListenOptions,
} from "https://deno.land/x/oak@v12.1.0/mod.ts";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | Array<JsonValue>
  | { [key: string]: JsonValue };

export type ProcedureCallback = (
  // deno-lint-ignore no-explicit-any
  ...args: any[]
) => JsonValue | Promise<JsonValue>;

export type Procedures = Record<string, ProcedureCallback>;
export type ProcedureError = { error: unknown };

export type ProcedureName<T extends Procedures> = keyof T & string;
export type ServerProcedures<T extends Procedures> = T;

export interface ProcedureCallPayload {
  procedureName: string;
  args?: JsonValue[];
}

function isProcedureCall(body: unknown): body is ProcedureCallPayload {
  if (typeof body === "object" && body) {
    return "procedureName" in body && typeof body["procedureName"] === "string";
  }
  return false;
}

export async function callRpc<T extends Procedures>(
  rpcs: T,
  { procedureName, args }: ProcedureCallPayload,
): Promise<JsonValue> {
  let result = rpcs[procedureName].apply(rpcs, args || []);
  if (result instanceof Promise) {
    result = await result;
  }
  return result;
}

export async function handleProcedureCall<T extends Procedures>(
  ctx: Context,
  rpcs: T,
) {
  const body = await ctx.request.body({ type: "json" }).value;
  if (isProcedureCall(body)) {
    // deno-lint-ignore no-prototype-builtins
    if (rpcs.hasOwnProperty(body.procedureName)) {
      const result = await callRpc(rpcs, body);
      ctx.response.status = 200;
      ctx.response.headers.set("content-type", "application/json");
      ctx.response.body = JSON.stringify(result);
    } else {
      ctx.response.status = 404;
      ctx.response.headers.set("content-type", "application/json");
      ctx.response.body = JSON.stringify({
        message: `procedureName '${body.procedureName}' not found`,
      });
    }
  } else {
    ctx.response.status = 400;
    ctx.response.headers.set("content-type", "application/json");
    ctx.response.body = JSON.stringify({
      message: "Invalid ProcedureCallPayload",
    });
  }
}

export function createListener<T extends Procedures>(
  rpcs: T,
  opts: ListenOptions,
) {
  const app = new Application();

  app.use((ctx) => handleProcedureCall(ctx, rpcs));

  const listener = app.listen(opts);
  // TODO: get addr from listener
  console.log(`Listening on port ${opts.port || 8000}`);
  return listener;
}

export async function serve<T extends Procedures>(
  rpcs: T,
  opts: ListenOptions,
) {
  await createListener(rpcs, opts);
}
