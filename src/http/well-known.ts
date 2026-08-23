const securityTxt = [
  "Contact: mailto:contact@mynameistito.com",
  "Canonical: https://mynameistito.com/.well-known/security.txt",
  "Policy: https://mynameistito.com/terms-of-service",
  "Encryption: https://mynameistito.com/.well-known/pgp.txt",
  "Acknowledgments: https://mynameistito.com/security-acknowledgments.txt",
  "Expires: 2027-01-01T00:00:00.000Z",
].join("\n");

const dntPolicyTxt = [
  "# Do Not Track Policy for mynameistito.com",
  "# Last Updated: 2026-08-23",
  "",
  "This website, mynameistito.com, does not currently respond to Do Not Track (DNT) signals transmitted by web browsers.",
  "",
  "Our data collection and usage practices are governed by our main Privacy Policy, available at https://mynameistito.com/privacy-policy. We encourage you to review our Privacy Policy to understand how we handle user data.",
  "",
  "For questions regarding our privacy practices, please contact contact@mynameistito.com.",
].join("\n");

const textResponse = (body: string): Response =>
  new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });

const dntResponse = (): Response =>
  new Response('{"policy": "/.well-known/dnt-policy.txt"}', {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "application/tracking-status+json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });

/**
 * Render a registered well-known resource for the supplied public origin.
 *
 * @param pathname - The request pathname.
 * @returns The static resource response, or `undefined` for other paths.
 */
export const wellKnownResponse = (pathname: string): Response | undefined => {
  switch (pathname) {
    case "/.well-known/security.txt": {
      return textResponse(securityTxt);
    }
    case "/.well-known/dnt-policy.txt": {
      return textResponse(dntPolicyTxt);
    }
    case "/.well-known/dnt": {
      return dntResponse();
    }
    default: {
      return undefined;
    }
  }
};
