/**
 * Refreshes the Supabase session cookie on every request and gates the app:
 * anything outside /login requires a signed-in user.
 *
 * This is a redirect for UX, not a security boundary — RLS is the boundary.
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname.startsWith('/login');

  /*
   * Enquiry intake is public by design: it is posted to by visitors on client
   * sites, who have no account here and never will. Redirecting it to /login
   * turned every submission into a 307 towards a sign-in page.
   *
   * Exempted here rather than narrowing the matcher, so the default stays
   * "everything is gated" and each public route has to say so explicitly.
   * The route does its own checking — known site id, honeypot, rate limit,
   * origin — and writes nothing else.
   */
  const isPublicApi = pathname === '/api/enquiry';

  if (!user && !isLogin && !isPublicApi) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/sites';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
