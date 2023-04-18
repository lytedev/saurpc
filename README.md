# saurpc

`saurpc` is a tiny set of functions and types to make strongly-typed RPC easily
manageable across TypeScript projects.

# Usage

Please refer to the automated documentation:

- https://deno.land/x/saurpc/mod.ts

Or if you need a particular version, you can specify it like so:

- https://deno.land/x/saurpc@0.4.0/mod.ts

## Example

A very basic example is available in [./mod_test.ts](./mod_test.ts).

# Development

## Pre-Commit Hook

```bash
deno task setup-pre-commit
```

## Run CI Locally

```bash
deno task ci
```

## Format Code

```bash
deno task fix
```
