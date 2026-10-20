/** Use for protected API requests so expired sessions always return to login. */
export async function sessionFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response | null> {
  const response = await fetch(input, { ...init, cache: "no-store" });
  const redirectedToLogin = response.redirected && new URL(response.url).pathname === "/login";

  if (response.status === 401 || redirectedToLogin) {
    window.location.replace("/login");
    return null;
  }

  return response;
}
