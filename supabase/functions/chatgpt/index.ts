/** Decision Ledger authenticated AI chat. No browser-exposed OpenAI key. */
import { createClient } from 'npm:@supabase/supabase-js@2';

const DEFAULT_ORIGIN = 'https://decision-ledger-app.netlify.app';
const origins = (Deno.env.get('AI_ALLOWED_ORIGINS') || DEFAULT_ORIGIN)
  .split(',').map((s) => s.trim()).filter(Boolean);
const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && origins.includes(origin) ? origin : DEFAULT_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-count',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '3600',
  'Vary': 'Origin',
});
const respond = (data: Record<string, unknown>, status: number, headers: Record<string, string>) =>
  Response.json(data, { status, headers: { ...headers, 'Cache-Control': 'no-store' } });

type ChatMessage = { role: 'user' | 'assistant'; content: string };
function validHistory(value: unknown): value is ChatMessage[] {
  return Array.isArray(value) && value.length <= 8 && value.every((item) =>
    item && typeof item === 'object' &&
    (item.role === 'user' || item.role === 'assistant') &&
    typeof item.content === 'string' && item.content.length > 0 && item.content.length <= 1500
  );
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  // Browser-origin restrictions are an extra safeguard, not authentication.
  if (origin && !origins.includes(origin)) {
    return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  }
  const headers = corsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return respond({ error: 'Use POST' }, 405, headers);

  const key = Deno.env.get('OPENAI_API_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key || !url || !anonKey || !adminKey) {
    console.error('Chat service missing required secrets');
    return respond({ error: 'AI service is not configured' }, 503, headers);
  }

  const bearer = req.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!bearer) return respond({ error: 'Sign in to use AI chat' }, 401, headers);

  try {
    const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await auth.auth.getUser(bearer);
    if (authError || !user) return respond({ error: 'Sign in to use AI chat' }, 401, headers);

    const body = await req.json();
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const history = body?.history ?? [];
    if (!prompt || prompt.length > 4000 || !validHistory(history)) {
      return respond({ error: 'Enter a prompt (1–4000 characters) and up to 8 short history messages' }, 400, headers);
    }

    // Atomic, fail-closed quota prevents a single signed-in account from generating unlimited API cost.
    const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const configuredLimit = Number(Deno.env.get('AI_DAILY_REQUEST_LIMIT') || 25);
    const limit = Number.isInteger(configuredLimit) && configuredLimit >= 1 && configuredLimit <= 1000 ? configuredLimit : 25;
    const { data: allowed, error: quotaError } = await admin.rpc('consume_ai_quota', {
      p_user_id: user.id,
      p_limit: limit,
    });
    if (quotaError) {
      console.error('AI quota check failed:', quotaError.code);
      return respond({ error: 'AI quota service is unavailable' }, 503, headers);
    }
    if (!allowed) return respond({ error: 'Daily AI message limit reached. Try again tomorrow.' }, 429, headers);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are the Decision Ledger AI assistant. Provide helpful, concise decision-analysis guidance. You cannot access the user\'s private ledger or workspace records unless the user explicitly includes them in their message. Never fabricate citations, decisions, or access to the ledger. Explain uncertainty when needed.' },
          ...history,
          { role: 'user', content: prompt },
        ],
        max_completion_tokens: 700,
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      console.error('OpenAI request failed:', response.status);
      return respond({ error: 'The AI request failed. Please try again.' }, 502, headers);
    }
    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) {
      return respond({ error: 'The AI returned an empty response' }, 502, headers);
    }
    return respond({ answer: answer.slice(0, 12000) }, 200, headers);
  } catch (error) {
    if (error instanceof SyntaxError) return respond({ error: 'Invalid JSON request' }, 400, headers);
    console.error('AI request failed:', error instanceof Error ? error.name : 'unknown');
    return respond({ error: 'AI service temporarily unavailable' }, 503, headers);
  }
});
