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
export type ProcedureErrorType =
  | "procedure_not_found"
  | "invalid_saurpc_payload"
  | "exception_thrown";

export class ProcedureError<T extends Procedures> extends Error {
  type: ProcedureErrorType;
  data?: unknown;

  constructor({ message, type, data }:
    & { message: string; type: ProcedureErrorType }
    & (
      | {
        type: "procedure_not_found";
        message: string;
        data: ProcedureCallPayload<T>;
      }
      | {
        type: "invalid_saurpc_payload";
        message: string;
        data: Request;
      }
      | {
        type: "exception_thrown";
        message: string;
        data: { request: Request; error: unknown };
      }
    )) {
    let cause = undefined;
    if ("error" in data) {
      cause = data.error;
    }
    super(message, { cause: cause });

    this.type = type;
    this.data = data;
  }
}

export type PublicProcedureError<T extends Procedures> =
  & Pick<ProcedureError<T>, "message" | "type">
  & Partial<Omit<ProcedureError<T>, "message" | "type">>;

export type ProcedureName<T extends Procedures> = keyof T & string;
export type ServerProcedures<T extends Procedures> = T;

export interface ProcedureCallPayload<T extends Procedures> {
  procedureName: keyof T;
  args?: JsonValue[];
}

export function procedureNamesFor<T extends Procedures>(rpcs: T): Set<keyof T> {
  return new Set(Object.keys(rpcs));
}

function isProcedureCall<T extends Procedures>(
  body: unknown,
): body is ProcedureCallPayload<T> {
  if (typeof body === "object" && body) {
    return "procedureName" in body && typeof body["procedureName"] === "string";
  }
  return false;
}

export async function callRpc<T extends Procedures>(
  rpcs: T,
  { procedureName, args }: ProcedureCallPayload<T>,
): Promise<JsonValue> {
  let result = rpcs[procedureName].apply(null, args || []);
  if (result instanceof Promise) {
    result = await result;
  }
  return result;
}

export async function handleProcedureCall<T extends Procedures>(
  request: Request,
  rpcs: T,
): Promise<Response> {
  try {
    const body = await request.json();
    if (isProcedureCall(body)) {
      // deno-lint-ignore no-prototype-builtins
      if (rpcs.hasOwnProperty(body.procedureName)) {
        const result = await callRpc(rpcs, body);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      } else {
        throw new ProcedureError({
          type: "procedure_not_found",
          message: `No RPC with procedureName '${body.procedureName}'`,
          data: body,
        });
      }
    } else {
      throw new ProcedureError({
        type: "invalid_saurpc_payload",
        message: `Could not parse request body as a valid saurpc request`,
        data: request,
      });
    }
  } catch (error) {
    if (error instanceof ProcedureError) {
      throw error;
    } else {
      throw new ProcedureError({
        type: "exception_thrown",
        message: `An exception was thrown when trying to handle the call`,
        data: { request, error },
      });
    }
  }
}
