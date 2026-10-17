export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN || "https://informed-lizard-8203.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
