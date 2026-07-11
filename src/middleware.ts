// Session gate for all app pages. This only handles *authentication*
// redirects for pages; *authorization* (roles) is enforced inside every
// API route handler via requireRole() - never trusted to the client.
export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
