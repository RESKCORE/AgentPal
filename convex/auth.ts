import Google from "@auth/core/providers/google";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Anonymous({
      profile: (params) => ({
        name: (params.name as string) || "Guest",
        ...(params.email ? { email: params.email as string } : {}),
        isAnonymous: true,
      }),
    }),
  ],
});

