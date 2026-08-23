const policyDate = "2026-08-23";

const securityContact = "mailto:security@mynameistito.com";

const securityTxt = (origin: URL): string =>
  [
    `Contact: ${securityContact}`,
    "Expires: 2027-08-23T00:00:00.000Z",
    "Preferred-Languages: en",
    `Canonical: ${new URL("/.well-known/security.txt", origin)}`,
    "",
  ].join("\n");

const dntPolicyTxt = [
  "Do Not Track Compliance Policy",
  "",
  "Version 1.0",
  "",
  `Last Updated: ${policyDate}`,
  "",
  'This service complies with user opt-outs from tracking via the "Do Not Track"',
  'or "DNT" request header. The service does not use tracking cookies, targeted',
  "advertising, or cross-site tracking. Requests are processed only to provide",
  "the service's public Instagram metadata and media redirects.",
  "",
  "When a request includes DNT: 1, the service will not use request data for",
  "tracking or combine it with data from other requests for tracking purposes.",
  "",
  "This policy is published at /.well-known/dnt-policy.txt.",
  "",
].join("\n");

const textResponse = (body: string): Response =>
  new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });

const dntResponse = (origin: URL): Response =>
  Response.json(
    {
      policy: new URL("/.well-known/dnt-policy.txt", origin).toString(),
      tracking: "N",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=86400",
        "Content-Type": "application/tracking-status+json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );

/**
 * Render a registered well-known resource for the supplied public origin.
 *
 * @param pathname - The request pathname.
 * @param origin - The public origin used in canonical and policy links.
 * @returns The static resource response, or `undefined` for other paths.
 */
export const wellKnownResponse = (
  pathname: string,
  origin: URL
): Response | undefined => {
  switch (pathname) {
    case "/.well-known/security.txt": {
      return textResponse(securityTxt(origin));
    }
    case "/.well-known/dnt-policy.txt": {
      return textResponse(dntPolicyTxt);
    }
    case "/.well-known/dnt": {
      return dntResponse(origin);
    }
    default: {
      return undefined;
    }
  }
};
