import {
  ProcedureCallPayload,
  ProcedureName,
  Procedures,
  PublicProcedureError,
} from "./server.ts";

class ClientProcedureError extends Error {
  type: string;
  data?: unknown;

  constructor({ type, error, ...opts }: {
    type: "server_error";
    error: PublicProcedureError;
  } | {
    type: "client_exception";
    error: unknown;
    response?: Response;
  }) {
    super(`ClientProcedureError: ${type}: ${error}`, { cause: error });

    this.type = type;
    this.data = opts;

    this.name = "ClientProcedureError";
  }
}

export function buildRequestFor<
  T extends Procedures,
  S extends ProcedureName<T>,
>(
  url: string | URL,
  procedureName: S,
  args: Parameters<T[S]>,
  opts?: { headers: Headers | [string, string][] | Record<string, string> },
): Request {
  const headers = new Headers(opts?.headers || {});
  headers.set("content-type", "application/json");
  const payload: ProcedureCallPayload = {
    procedureName,
    args,
  };
  return new Request(url, {
    method: "post",
    headers,
    body: JSON.stringify(payload),
  });
}

export class Client<T extends Procedures> {
  #base: string | URL;

  constructor(endpoint: string | URL) {
    this.#base = endpoint;
  }

  async call<S extends ProcedureName<T>>(
    procedureName: S,
    args: Parameters<T[S]>,
    opts?: { headers: Headers | [string, string][] | Record<string, string> },
  ): Promise<ReturnType<T[S]>> {
    let response: Response | undefined = undefined;
    try {
      const request = buildRequestFor(this.#base, procedureName, args, opts);
      response = await fetch(request);
      const body = await response.json();
      if (response.status == 200) {
        return body as ReturnType<T[S]>;
      } else {
        // TODO: check that body is a PublicProcedureError
        throw new ClientProcedureError({
          type: "server_error",
          error: body as PublicProcedureError,
        });
      }
    } catch (error) {
      throw { type: "client_exception", error, response };
    }
  }
}
