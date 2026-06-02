import { didErrorResponse, verifyDidApiKey } from '@/lib/did-agent-server';

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { apiKey?: string };
    return Response.json(await verifyDidApiKey(payload.apiKey ?? ''));
  } catch (error) {
    return didErrorResponse(error);
  }
}
