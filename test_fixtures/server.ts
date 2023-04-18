export const rpcs = {
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

export type MyRpcs = typeof rpcs;
