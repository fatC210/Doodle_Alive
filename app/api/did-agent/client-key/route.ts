import { NextResponse } from 'next/server';
import { didErrorResponse, refreshDidAgentClientKey } from '@/lib/did-agent-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await refreshDidAgentClientKey(payload);
    return NextResponse.json(result);
  } catch (error) {
    return didErrorResponse(error);
  }
}