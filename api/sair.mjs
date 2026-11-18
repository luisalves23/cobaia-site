import { cookieSair } from '../lib/compras.mjs';
import { redirecionar } from '../lib/ui.mjs';
export function GET() { return redirecionar('/acesso/?saiu=1', { 'set-cookie': cookieSair() }); }
export const POST = GET;
