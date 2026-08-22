# ADR 003: Credential-Free Fixture Metadata Provider

## Decision

Plan 003 uses a `fixture-json` metadata adapter as the first provider. It accepts versioned local JSON values through the application-owned metadata source port and parses them into `InstagramPost` at the adapter boundary.

## Rationale

The repository has no approved Instagram credentials or access-control bypass. Public Instagram HTML and remote scraper services are unstable and would require live network behavior in tests. A fixture provider keeps provider selection replaceable while making parsing, typed failures, cache behavior, cancellation, and telemetry deterministic.

The adapter accepts only HTTPS media URLs and never follows URLs from fixture payloads. It does not perform HTTP requests, login, scraping, proxying, or raw-payload logging.

## Limitations

Fixtures do not prove that current Instagram markup or a remote provider schema remains compatible. A future provider may implement the same `InstagramMetadataSource` port after its endpoint, credentials, response schema, redirect policy, and health behavior are explicitly approved.
