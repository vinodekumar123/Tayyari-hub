import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define route patterns
const PUBLIC_ROUTES = ['/', '/login', '/signup', '/forgot-password'];
const STUDENT_ROUTES = ['/dashboard/student', '/quiz'];

// Strict Admin Routes (SuperAdmin & Admin Only)
const ADMIN_ONLY_ROUTES = [
    '/admin/students',       // Teachers cannot see students
    '/admin/courses',        // Teachers cannot see/edit courses (series)
    '/admin/settings',
    '/admin/statistics'
];

// Shared Admin/Teacher Routes
const TEACHER_ROUTES = [
    '/admin/questions',
    '/admin/mockquestions',
    '/admin/quizzes',
    '/admin/reports',
    '/dashboard/admin'      // Shared Dashboard
];

// Helpers to check route matches
const isPublic = (path: string) => PUBLIC_ROUTES.some(r => path === r || path.startsWith(r));

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // 1. Skip Static Assets & Next.js internals
    if (path.startsWith('/_next') || path.includes('.')) {
        return NextResponse.next();
    }

    // 2. Allow Public Routes (Pages)
    if (isPublic(path)) {
        return NextResponse.next();
    }

    // 3. API Route Protection
    if (path.startsWith('/api')) {
        // Public APIs (e.g. Auth related if any, or webhooks)
        // For now, assuming most APIs need at least some check, 
        // but explicit /api/admin/* MUST have Authorization header check here?
        // Actually, verifying the token in middleware (Edge) requires `jose` or similar 
        // because firebase-admin doesn't run on Edge. 
        // Using "Pre-flight-like" check: If it's an admin API, ensure Auth header exists.

        if (path.startsWith('/api/admin')) {
            const authHeader = request.headers.get('authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return NextResponse.json({ success: false, error: 'Unauthorized: Missing Token' }, { status: 401 });
            }
        }

        // Pass through to the API route handler which does specific verification
        return NextResponse.next();
    }

    // 4. Page Protection (Client-side app fallback)
    // As noted previously, without Session Cookies, we can't fully enforce RBAC here for pages.
    // relying on Client Components authentication.

    // --- SECURITY HEADERS ---
    const response = NextResponse.next();
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // CSP: Restrict primitive XSS. 
    // Note: 'unsafe-eval' often needed for complex frameworks/charts in dev, 'unsafe-inline' for Next.js inline scripts.
    // Production/Strict CSP requires Nonces. Setting a baseline.
    const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.algolia.net https://*.algolianet.com wss://*.firebaseio.com;";
    response.headers.set('Content-Security-Policy', csp);

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
