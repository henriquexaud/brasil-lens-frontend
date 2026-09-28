// Repassa à Open-Meteo as consultas da API do Brasil Lens. A cota grátis da Open-Meteo é
// por IP, e o IP de saída do Render é compartilhado com outros serviços que a esgotam;
// daqui a chamada sai pelos IPs da Vercel. Sem a chave, recusa: não é um proxy aberto.
const UPSTREAM = 'https://api.open-meteo.com/v1/forecast';

export async function GET(request: Request): Promise<Response> {
  const key = process.env.OPEN_METEO_RELAY_KEY;
  if (!key || request.headers.get('x-relay-key') !== key) {
    return new Response('Chave de repasse ausente ou inválida.', { status: 401 });
  }
  const upstream = await fetch(UPSTREAM + new URL(request.url).search);
  const headers = new Headers({
    'content-type': upstream.headers.get('content-type') ?? 'application/json',
  });
  const retryAfter = upstream.headers.get('retry-after');
  if (retryAfter) headers.set('retry-after', retryAfter);
  return new Response(upstream.body, { status: upstream.status, headers });
}
