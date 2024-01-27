// Common Types
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | Array<JsonValue>
  | { [key: string]: JsonValue };

export type Procedure = (
  // deno-lint-ignore no-explicit-any
  ...args: any[]
) => JsonValue | Promise<JsonValue>;

export type ProcedureSet = Record<string, Procedure>;
export type ProcedureName<T extends ProcedureSet> = string & keyof T;

export interface ProcedureCallPayload {
  procedureName: string;
  args: JsonValue[];
}

// Server Types
export type ProcedureServerErrorType =
  | "rpc_not_found"
  | "invalid_request"
  | "exception_caught";

type ProcedureServerErrorInit = {
  message: string;
  type: ProcedureServerErrorType;
  data?: unknown;
  cause?: Error;
};

export class ProcedureServerError extends Error {
  type: ProcedureServerErrorType;
  data?: unknown;

  constructor({ message, type, data, cause }: ProcedureServerErrorInit) {
    super(message, { cause: cause });

    this.type = type;
    this.data = data;
  }
}

// Server Functions
export async function runRpc<T extends ProcedureSet, S extends keyof T>(
  rpcs: T,
  procedureName: S,
  ...args: Parameters<T[S]>
): Promise<JsonValue> {
  let result = rpcs[procedureName].apply(null, args);
  if (result instanceof Promise) {
    result = await result;
  }
  return result;
}

export async function toProcedureCall(
  request: Request,
): Promise<ProcedureCallPayload> {
  let body: unknown;
  let procedureName: string;
  let args: JsonValue[];
  try {
    body = await request.json();
  } catch {
    throw new ProcedureServerError({
      type: "invalid_request",
      message: `Could not parse request body as JSON`, // TODO: add suggestions
      data: request,
    });
  }
  // body may be array of args
  if (Array.isArray(body)) {
    const url = new URL(request.url);
    const rpc = url.searchParams.get("rpc");
    if (rpc !== null) {
      procedureName = rpc;
    } else {
      throw new ProcedureServerError({
        type: "invalid_request",
        message: "Missing 'rpc' query paramater in request",
        data: request,
      });
    }
    args = body;
  } else if (typeof body === "object" && body) {
    if (
      "procedureName" in body && typeof body["procedureName"] === "string"
    ) {
      procedureName = body["procedureName"];
    } else {
      throw new ProcedureServerError({
        type: "invalid_request",
        message:
          `Could not parse procedureName string from JSON body of type 'object'`,
        data: body,
      });
    }
    if (
      "args" in body && typeof Array.isArray(body["args"])
    ) {
      args = body["args"] as JsonValue[];
    } else {
      throw new ProcedureServerError({
        type: "invalid_request",
        message: `Could not parse args array from JSON body of type 'object'`,
        data: request,
      });
    }
  } else {
    throw new ProcedureServerError({
      type: "invalid_request",
      message: "JSON body was neither an object nor an array.",
      data: request,
    });
  }
  return { procedureName, args };
}

export async function handleRpcRequest<T extends ProcedureSet>(
  request: Request,
  rpcs: T,
): Promise<Response> {
  const { procedureName, args } = await toProcedureCall(request);
  if (!(procedureName in rpcs)) {
    throw new ProcedureServerError({
      type: "rpc_not_found",
      message: `No RPC with procedureName '${procedureName}'`,
    });
  }
  try {
    const result = await runRpc(
      rpcs,
      procedureName,
      ...args as Parameters<T[typeof procedureName]>,
    );
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    if (err instanceof Error) {
      throw new ProcedureServerError({
        type: "exception_caught",
        message: err.message,
        cause: err,
      });
    } else {
      throw new ProcedureServerError({
        type: "exception_caught",
        message: "An exception occurred",
        cause: err,
      });
    }
  }
}

// Client Types
export type PublicProcedureServerError =
  & Pick<ProcedureServerError, "message" | "type">
  & Partial<Omit<ProcedureServerError, "message" | "type">>;

export type ProcedureClientErrorType =
  | "rpc_error"
  | "exception_caught";

type ProcedureClientErrorInit = {
  message: string;
  type: ProcedureClientErrorType;
  data?: unknown;
  cause?: Error;
};

export class ProcedureClientError extends Error {
  type: ProcedureClientErrorType;
  data?: unknown;

  constructor({ message, type, data, cause }: ProcedureClientErrorInit) {
    super(message, { cause: cause });

    this.type = type;
    this.data = data;
  }
}

export type ClientProcedures<T extends ProcedureSet> = {
  [S in keyof T]: T[S] extends (...args: Parameters<T[S]>) => JsonValue
    ? (...args: Parameters<T[S]>) => Promise<ReturnType<T[S]>>
    : (...args: Parameters<T[S]>) => ReturnType<T[S]>;
};

// Client Functions
export function createRpcRequestWithOptions<
  T extends ProcedureSet,
  S extends ProcedureName<T>,
>(
  input: RequestInfo,
  procedureName: S,
  opts: RequestInit,
  ...args: Parameters<T[S]>
): Request {
  // make sure the server knows we are sending json
  const headers = opts?.headers ? new Headers(opts.headers) : new Headers();
  headers.set("content-type", "application/json");

  // include the procedure name in the query parameters
  if (input instanceof Request) {
    const newUrl = new URL(input.url);
    newUrl.searchParams.set("rpc", procedureName);
    input = new Request(input, {});
  } else if (typeof input === "string") {
    const newUrl = new URL(input);
    newUrl.searchParams.set("rpc", procedureName);
    input = newUrl.toString();
  }

  // serialize the body
  opts.body = JSON.stringify(args);
  opts.method = "post";

  return new Request(input, opts);
}

export async function handleRpcResponse(
  response: Response,
): Promise<JsonValue> {
  try {
    const body = await response.json();
    if (response.status == 200) {
      return body;
    } else {
      // TODO: check that body is a PublicProcedureError!
      throw new ProcedureClientError({
        type: "rpc_error",
        message: body["message"] as string,
        data: body,
      });
    }
  } catch (error) {
    if (error instanceof ProcedureClientError) {
      throw error;
    } else {
      throw new ProcedureClientError({
        type: "exception_caught",
        message: error.message,
        cause: error,
      });
    }
  }
}

export function createRpcRequest<
  T extends ProcedureSet,
  S extends ProcedureName<T>,
>(input: RequestInfo, procedureName: S, ...args: Parameters<T[S]>): Request {
  return createRpcRequestWithOptions(input, procedureName, {}, ...args);
}

export function genCalls<T extends ProcedureSet>(
  names: ProcedureName<T>[],
  input?: RequestInfo,
  opts?: RequestInit,
): ClientProcedures<T> {
  // deno-lint-ignore no-explicit-any
  const result: Record<string, any> = {};
  for (const name of names) {
    // deno-lint-ignore no-explicit-any
    result[name] = async (...args: any[]) => {
      return await handleRpcResponse(
        await fetch(
          createRpcRequestWithOptions(
            input || "/",
            name,
            opts || {},
            ...args,
          ),
        ),
      );
    };
  }
  return result as ClientProcedures<T>;
}

export function genLocalCalls<T extends ProcedureSet>(
  rpcs: ProcedureSet,
  input?: RequestInfo,
  opts?: RequestInit,
): ClientProcedures<T> {
  // deno-lint-ignore no-explicit-any
  const result: Record<string, any> = {};
  for (const name in rpcs) {
    // deno-lint-ignore no-explicit-any
    result[name] = async (...args: any[]) => {
      return await handleRpcResponse(
        await handleRpcRequest(
          createRpcRequestWithOptions(
            input || "http://localhost",
            name,
            opts || {},
            ...args,
          ),
          rpcs,
        ),
      );
    };
  }
  return result as ClientProcedures<T>;
}
