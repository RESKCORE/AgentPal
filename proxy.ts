import { clerkMiddleware } from "@clerk/nextjs/server";

// Match public routes directly without using the deprecated createRouteMatcher
const isPublicRoute = (pathname: string) => {
  return (
    pathname === "/" ||
    pathname === "/overview" ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/deals/invite") ||
    pathname.includes("/join")
  );
};

export default clerkMiddleware(
  async (auth, request) => {
    // Let API routes handle their own 401 JSON responses instead of redirecting to /sign-in
    if (request.nextUrl.pathname.startsWith("/api")) {
      return;
    }
    // Allow guest demo evaluations without forcing Clerk OAuth redirect
    if (request.cookies.get("agentpal_guest")?.value === "true") {
      return;
    }
    if (!isPublicRoute(request.nextUrl.pathname)) {
      await auth.protect();
    }
  },
  {
    // Accommodate local clock drift up to 60 seconds to prevent clock skew warnings
    clockSkewInMs: 60000,
  }
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
