import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session if expired. Required for Server Components, which
  // can't write cookies themselves.
  //
  // The Encounter live-state poll hits this every few seconds per viewer, so for that one route verify the
  // token locally (getClaims -- checks the signature against the cached public key, still refreshes an
  // expired session) instead of a getUser() round trip to Supabase Auth on every request. Everything else
  // keeps the full server-side check.
  if (/^\/api\/encounters\/[^/]+\/live$/.test(request.nextUrl.pathname)) {
    await supabase.auth.getClaims();
  } else {
    await supabase.auth.getUser();
  }

  return response;
}
