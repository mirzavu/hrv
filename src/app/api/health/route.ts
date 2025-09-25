import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'OK', 
    message: 'HRV Next.js API is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
}
