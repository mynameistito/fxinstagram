// oxlint-disable-next-line sonarjs/no-wildcard-import -- SAFETY: namespace import is the documented Alchemy stack style.
import * as Alchemy from "alchemy";
// oxlint-disable-next-line sonarjs/no-wildcard-import -- SAFETY: namespace import keeps the Cloudflare stack API cohesive.
import * as Cloudflare from "alchemy/Cloudflare";
import {
  Comment,
  GitHubEnv,
  providers as githubProviders,
} from "alchemy/GitHub";
import { interpolate } from "alchemy/Output";
import { Stage } from "alchemy/Stage";
import { Config, Effect, Layer } from "effect";

const PROD_STAGE = "prod";
const WORKER_NAME = "fxinstagram";
const CUSTOM_DOMAIN = "ig.mynameistito.com";
const isAlchemyDev = ["1", "true"].includes(
  process.env.ALCHEMY_DEV?.toLowerCase() ?? ""
);

const workerEnvironment = {
  ALLOWED_MEDIA_HOSTS: Config.string("ALLOWED_MEDIA_HOSTS").pipe(
    Config.withDefault("scontent.cdninstagram.com")
  ),
  METADATA_CACHE_TTL_SECONDS: Config.string("METADATA_CACHE_TTL_SECONDS").pipe(
    Config.withDefault("60")
  ),
  METADATA_PROVIDER_TOKEN: Config.string("METADATA_PROVIDER_TOKEN").pipe(
    Config.withDefault("")
  ),
  METADATA_TIMEOUT_MS: Config.string("METADATA_TIMEOUT_MS").pipe(
    Config.withDefault("5000")
  ),
  PUBLIC_ORIGIN: Cloudflare.Worker.URL,
};

/** Stage-specific physical identity for the deployed Worker. */
export type WorkerIdentity =
  | {
      /** The canonical custom domain attached in production. */
      readonly domain: string;
      /** The pinned production script name. */
      readonly name: string;
      /** Production is served only through its custom domain. */
      readonly workersDev: false;
    }
  | {
      /** Preview and development stages do not claim a custom domain. */
      readonly domain?: never;
      /** The isolated, stage-qualified script name. */
      readonly name: string;
      /** Non-production stages expose their workers.dev URL. */
      readonly workersDev: true;
    };

/** Resolve an isolated Worker identity, reserving the custom domain for prod. */
export const resolveWorkerIdentity = (stage: string): WorkerIdentity =>
  stage === PROD_STAGE
    ? { domain: CUSTOM_DOMAIN, name: WORKER_NAME, workersDev: false }
    : { name: `${WORKER_NAME}-${stage}`, workersDev: true };

/** Declare the Worker with concrete stage-specific identity. */
export const makeWorker = (stage: string) => {
  const identity = resolveWorkerIdentity(stage);
  return Cloudflare.Worker("FxinstagramWorker", {
    ...identity,
    env: workerEnvironment,
    main: "./src/runtime/worker.ts",
    observability: { enabled: stage === PROD_STAGE },
  });
};

/** Build stage resources and publish the preview URL on pull requests. */
export const buildStack = Effect.gen(function* buildStack() {
  const stage = yield* Stage;
  const worker = yield* makeWorker(stage);
  const github = yield* GitHubEnv;

  if (github?.pr) {
    yield* Comment("preview-comment", {
      body: interpolate`
        ## Preview deployed

        **URL:** ${worker.url}

        Built from commit ${github.sha.slice(0, 7)}.

        _This comment updates automatically with each deployment._
      `,
      issueNumber: github.pr,
      owner: github.owner,
      repository: github.repository,
    });
  }

  return { url: worker.url };
});

/** The fxinstagram Alchemy stack consumed by the CLI. */
export default Alchemy.Stack(
  "fxinstagram",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), githubProviders()),
    state: isAlchemyDev ? Alchemy.localState() : Cloudflare.state(),
  },
  buildStack
);
