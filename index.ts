import { Effect } from "effect";

import { bootstrap } from "./src/runtime/bootstrap.ts";

await Effect.runPromise(bootstrap);
