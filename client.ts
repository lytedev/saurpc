import {
  JsonValue,
  ProcedureCallPayload,
  ProcedureName,
  Procedures,
  PublicProcedureError,
} from "./server.ts";

export type ClientProcedures<T extends Procedures> = {
  [S in keyof T]: T[S] extends (...args: Parameters<T[S]>) => JsonValue
    ? (...args: Parameters<T[S]>) => Promise<ReturnType<T[S]>>
    : (...args: Parameters<T[S]>) => ReturnType<T[S]>;
};

export class ClientProcedureError<T extends Procedures> extends Error {
  type: string;
  data?: unknown;

  constructor({ type, error, ...data }: {
    type: "server_error";
    error: PublicProcedureError<T>;
  } | {
    type: "client_exception";
    error: unknown;
    response?: Response;
  }) {
    let errorMessage = error;
    if (type === "server_error") {
      errorMessage = error.message || error.type;
    }
    super(`${type}: ${errorMessage}`, { cause: error });

    this.type = type;
    this.data = data;

    // this.name = "ClientProcedureError";
  }
}

export function buildRequestFor<
  T extends Procedures,
  S extends ProcedureName<T>,
>(
  url: string | URL,
  procedureName: S,
  args: Parameters<T[S]>,
  opts?: RequestInit,
): Request {
  const headers = new Headers(opts?.headers || {});
  headers.set("content-type", "application/json");
  const payload: ProcedureCallPayload<T> = {
    procedureName,
    args,
  };
  if (url instanceof URL) {
    url.searchParams.set("_saurpc", procedureName);
  } else {
    if (url.includes("?")) {
      url += `&_saurpc=${procedureName}`;
    } else {
      url += `?_saurpc=${procedureName}`;
    }
  }
  return new Request(url, {
    ...opts,
    method: "post",
    headers,
    body: JSON.stringify(payload),
  });
}

export function callsFor<
  T extends Procedures,
>(rpcs: T): ClientProcedures<T> {
  // @ts-ignore: I know what I'm doing... I hope
  const result: ClientProcedures<T> = {};
  // @ts-ignore: I know what I'm doing... I hope
  Object.entries(rpcs).forEach(([rpcName, _]) =>
    // @ts-ignore: I know what I'm doing... I hope
    // deno-lint-ignore no-explicit-any
    result[rpcName] = (...args: any[]) => {
      // @ts-ignore: I know what I'm doing... I hope
      return this.call(rpcName, ...args);
    }
  );
  return result;
}

export class Client<T extends Procedures> {
  #base: string | URL;
  #opts: RequestInit;
  calls: ClientProcedures<T>;

  constructor(endpoint: string | URL, rpcs: T, opts?: RequestInit) {
    this.#base = endpoint;
    this.#opts = opts || {};
    this.calls = callsFor(rpcs);
  }

  async call<S extends ProcedureName<T>>(
    procedureName: S,
    ...args: Parameters<T[S]>
  ): Promise<ReturnType<T[S]>> {
    let response: Response | undefined = undefined;
    try {
      const request = buildRequestFor(
        this.#base,
        procedureName,
        args || [],
        this.#opts,
      );
      response = await fetch(request);
      const body = await response.json();
      if (response.status == 200) {
        return body as ReturnType<T[S]>;
      } else {
        // TODO: check that body is a PublicProcedureError
        throw new ClientProcedureError({
          type: "server_error",
          error: body as PublicProcedureError<T>,
        });
      }
    } catch (error) {
      if (error instanceof ClientProcedureError) {
        throw error;
      } else {
        throw new ClientProcedureError({
          type: "client_exception",
          error,
          response,
        });
      }
    }
  }
}
