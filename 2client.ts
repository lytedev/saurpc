import { JsonValue, MyRpcs, ProcedureSet } from "./2.ts";
export type ClientProcedures<T extends ProcedureSet> = {
  [S in keyof T]: T[S] extends (...args: Parameters<T[S]>) => JsonValue
    ? (...args: Parameters<T[S]>) => Promise<ReturnType<T[S]>>
    : (...args: Parameters<T[S]>) => ReturnType<T[S]>;
};

const rpcs: ClientProcedures<MyRpcs> = {
  async add(a: number, b: number) {
    // call server
    return await new Promise(() => a + b);
  },
  async ping() {
    // call server
    return await new Promise(() => "pong");
  },
};

rpcs.add(8, 9);
