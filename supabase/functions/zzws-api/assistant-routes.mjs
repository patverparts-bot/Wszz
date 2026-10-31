import {answerQuestion, validateQuestion} from './assistant.mjs';
const gates = new Map();
// Best-effort per-isolate protection in addition to authenticated application access.
export async function assistantRoutes(c) {
  const {path, req, user, body, current, project, json, fail, knowledge, publicCatalog, options = {}} = c;
  if (path !== 'assistant/chat' || req.method !== 'POST') return null;
  if (Number(req.headers.get('content-length') || 0) > 16000) fail(413, 'Հարցումը չափազանց մեծ է։');
  const payload = await body(req); validateQuestion(payload);
  const now = Date.now();
  for (const [id, gate] of gates) if (now - gate.start > 60000 && !gate.active) gates.delete(id);
  const gate = gates.get(user.id) || {start: now, count: 0, active: 0};
  if (now - gate.start >= 60000) { gate.start = now; gate.count = 0; }
  if (gate.count >= 15 || gate.active >= 2) fail(429, 'Խնդրում ենք մի փոքր սպասել և կրկին փորձել։');
  gate.count++; gate.active++; gates.set(user.id, gate);
  try {
    const version = await current();
    const products = project(version.products, user, version.rules);
    // The request may select KP only for an authenticated administrator.
    // Prices still come from the server-projected catalogue on every turn.
    const orderPriceMode=user.role==='admin'&&payload.orderPriceMode==='KP'?'KP':'WS';
    return json(await answerQuestion(payload, products, knowledge, {...options,orderPriceMode,publicCatalog}));
  } finally { gate.active--; }
}
