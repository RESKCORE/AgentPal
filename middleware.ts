import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isPublicRoute = createRouteMatcher(["/sign-in", "/deals/(.*)/join"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  // Let API routes handle their own 401 JSON responses instead of redirecting to /sign-in
  if (request.nextUrl.pathname.startsWith("/api")) {
    return;
  }
  if (!isPublicRoute(request) && !(await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/sign-in");
  }
});

export const config = {
  // Match all routes except Next.js internals and static files.
  // Must match /api/auth so Convex Auth proxy can intercept and handle signIn/signOut actions.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

