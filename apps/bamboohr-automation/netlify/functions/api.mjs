// Netlify Function (modern API) serving all /api/* traffic.
// The Express app is reused via serverless-http: the incoming web Request is
// converted to a Lambda-style event, and the result back to a web Response.
// The modern API keeps this file natively ESM — no CJS transpile shim.

import serverless from 'serverless-http';
import { createApp } from '../../src/app.js';

const lambdaHandler = serverless(createApp({ serveStatic: false }), {
  binary: ['application/pdf'],
});

export default async (req) => {
  const url = new URL(req.url);
  const bodyBuf = Buffer.from(await req.arrayBuffer());

  const headers = Object.fromEntries(req.headers.entries());
  // Guarantee the app can always rebuild its own absolute URLs (the paperwork
  // portal link), even if the platform omits a host header.
  headers.host = headers.host || url.host;
  headers['x-forwarded-host'] = headers['x-forwarded-host'] || url.host;
  headers['x-forwarded-proto'] = headers['x-forwarded-proto'] || url.protocol.replace(':', '');

  const event = {
    httpMethod: req.method,
    path: url.pathname,
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    headers,
    body: bodyBuf.length ? bodyBuf.toString('base64') : null,
    isBase64Encoded: true,
  };

  const res = await lambdaHandler(event, {});
  const body = res.isBase64Encoded ? Buffer.from(res.body || '', 'base64') : res.body;
  return new Response(body, { status: res.statusCode, headers: res.headers || {} });
};

export const config = {
  path: '/api/*',
};
