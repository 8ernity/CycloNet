import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/dashboard(.*)",
  "/forecast(.*)",
  "/infrastructure(.*)",
  "/reports(.*)",
  "/classification(.*)",
  "/compare(.*)",
  "/archive(.*)",
  "/settings(.*)",
  "/login(.*)",
  "/signup(.*)",
  "/api/(.*)",
  "/liquid-glass.js",
  "/Earth.png",
  "/Galaxy.mp4",
  "/favicon.ico",
]);

export default clerkMiddleware(async (auth, request) => {
  // All demo routes and landing pages are open for immediate judging evaluation
  // Authentication is optional for enhanced personal saved history
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4)).*)",
    "/(api|trpc)(.*)",
  ],
};
