import { NextResponse } from 'next/server';

// Simple test endpoint to verify API routes work
export async function GET() {
    return NextResponse.json({
        message: 'Test API is working!',
        timestamp: new Date().toISOString()
    });
}

export async function POST() {
    return NextResponse.json({
        message: 'POST test API is working!',
        timestamp: new Date().toISOString()
    });
}
