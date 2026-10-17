"use client";

import { ReactNode, useEffect, useState } from "react";
import { ConvexReactClient, useMutation, useConvexAuth } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth, useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";

function UserSyncer() {
  const { user } = useUser();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const syncUser = useMutation(api.deals.syncUser);

  useEffect(() => {
    // Only attempt profile sync once Convex has verified authentication
    if (isAuthenticated && !isLoading && user) {
      const name =
        user.fullName ||
        user.username ||
        (user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "Agent Operator");
      const email = user.primaryEmailAddress?.emailAddress || "";
      syncUser({ name, email }).catch((err) => {
        console.warn("User profile sync notice:", err?.message || err);
      });
    }
  }, [isAuthenticated, isLoading, user, syncUser]);

  return null;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  );

  return (
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      <UserSyncer />
      {children}
    </ConvexProviderWithClerk>
  );
}
