import {
  ProcedureCallPayload,
  ProcedureError,
  ProcedureName,
  Procedures,
} from "./server.ts";

export class Client<T extends Procedures> {
  #base: string | URL;

  constructor(endpoint: string | URL) {
    this.#base = endpoint;
  }

  async call<S extends ProcedureName<T>>(
    procedureName: S,
    args: Parameters<T[S]>,
    opts?: { headers: Headers | [string, string][] | Record<string, string> },
  ): Promise<ReturnType<T[S]> | ProcedureError> {
    const headers = new Headers(opts?.headers || {});
    headers.set("content-type", "application/json");
    const payload: ProcedureCallPayload = {
      procedureName,
      args,
    };
    const response = await fetch(this.#base, {
      method: "post",
      headers,
      body: JSON.stringify(payload),
    });
    if (response.status == 200) {
      return await response.json() as ReturnType<T[S]>;
    } else {
      return { error: response };
    }
  }
}
