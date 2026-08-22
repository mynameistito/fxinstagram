const child = Bun.spawn(
  [
    process.execPath,
    "x",
    "alchemy",
    "dev",
    "alchemy.run.ts",
    ...process.argv.slice(2),
  ],
  {
    env: {
      ...process.env,
      ALCHEMY_DEV: "true",
    },
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  }
);

process.exitCode = await child.exited;
