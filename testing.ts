import { handleProcedureCall, ProcedureName, Procedures } from "./server.ts";
import { buildRequestFor } from "./client.ts";

export async function callFor<T extends Procedures, S extends ProcedureName<T>>(
  rpcs: T,
  p: S,
  args: Parameters<T[S]>,
): Promise<ReturnType<T[S]>> {
  const call = await handleProcedureCall(
    buildRequestFor("file:///dev/null", p, args),
    rpcs,
  );
  return await call.json();
}

export function buildCall<
  T extends Procedures,
  S extends ProcedureName<T>,
>(rpcs: T): (p: S, args: Parameters<T[S]>) => Promise<ReturnType<T[S]>> {
  return async (p: S, args: Parameters<T[S]>) => await callFor(rpcs, p, args);
}
