import { handleProcedureCall, ProcedureName, Procedures } from "./server.ts";
import { buildRequestFor } from "./client.ts";

export async function callFor<
  T extends Procedures,
  S extends ProcedureName<T>,
  R extends ReturnType<T[S]>,
>(
  rpcs: T,
  p: S,
  ...args: Parameters<T[S]>
): Promise<ReturnType<T[S]>> {
  const call = await handleProcedureCall(
    buildRequestFor("file:///dev/null", p, args),
    rpcs,
  );
  return await call.json() as R;
}

export function buildCall<
  T extends Procedures,
  S extends ProcedureName<T>,
  R extends ReturnType<T[S]>,
>(rpcs: T): (p: S, ...args: Parameters<T[S]>) => Promise<ReturnType<T[S]>> {
  return async function (
    p: S,
    ...args: Parameters<T[S]>
  ) {
    return await callFor<T, S, R>(rpcs, p, ...args);
  };
}
