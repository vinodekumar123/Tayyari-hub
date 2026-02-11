import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge'; // Use Edge for speed

export async function GET(req: NextRequest) {
    try {
        // Get IP from headers (Vercel/Next.js helpers)
        const forwardedFor = req.headers.get('x-forwarded-for');
        const ip = forwardedFor ? forwardedFor.split(',')[0] : '127.0.0.1';

        // Skip lookup for localhost
        if (ip === '127.0.0.1' || ip === '::1') {
            return NextResponse.json({
                ip,
                city: 'Localhost',
                country: 'Localhost',
                region: 'Localhost'
            });
        }

        // Call ipapi.co server-side (No CORS issues)
        // Note: Free tier of ipapi.co is rate limited. Consider caching if possible?
        // For now, simple pass-through.
        const response = await fetch(`https://ipapi.co/${ip}/json/`, {
            headers: { 'User-Agent': 'TayyariHub-Server' }
        });

        if (!response.ok) {
            throw new Error(`GeoIP lookup failed: ${response.status}`);
        }

        const data = await response.json();

        return NextResponse.json({
            ip: data.ip || ip,
            city: data.city || 'Unknown',
            country: data.country_name || 'Unknown',
            region: data.region || ''
        });

    } catch (error) {
        console.error('GeoIP Error:', error);
        // Fallback response
        return NextResponse.json({
            ip: 'unknown',
            city: 'Unknown',
            country: 'Unknown',
            region: ''
        }, { status: 200 }); // Return 200 even on error to prevent client breakage
    }
}
