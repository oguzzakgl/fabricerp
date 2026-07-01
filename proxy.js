const http = require('http');
const net = require('net');

const BACKEND_URL = 'http://127.0.0.1:3001';
const FRONTEND_URL = 'http://127.0.0.1:5173';
const MARKETING_URL = 'http://127.0.0.1:4000';

// Helper to parse cookies from headers
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts[0]) {
      cookies[parts[0].trim()] = (parts[1] || '').trim();
    }
  });
  return cookies;
}

const server = http.createServer((req, res) => {
  const url = req.url;
  
  // 1. API ve statik dosya istekleri doğrudan backend sunucusuna yönlendirilir
  if (url.startsWith('/api') || url.startsWith('/public')) {
    const parsedTarget = new URL(BACKEND_URL);
    const headers = { ...req.headers };
    headers['host'] = parsedTarget.host;
    
    const proxyReq = http.request({
      hostname: parsedTarget.hostname,
      port: parsedTarget.port,
      path: req.url,
      method: req.method,
      headers: headers,
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });
    
    proxyReq.on('error', (err) => {
      console.error(`Proxy API error for ${url}:`, err.message);
      res.writeHead(502);
      res.end('Bad Gateway');
    });
    
    req.pipe(proxyReq, { end: true });
    return;
  }
  
  // 2. Determine target based on entry path or cookie session
  let target = MARKETING_URL;
  let setSessionCookie = null;
  
  if (
    url.startsWith('/login') ||
    url.startsWith('/dashboard') ||
    url.startsWith('/superadmin') ||
    url.startsWith('/onboarding')
  ) {
    target = FRONTEND_URL;
    setSessionCookie = 'erp_session=true; Path=/; SameSite=Lax';
  } else if (url === '/' || url.startsWith('/register') || url.startsWith('/contact')) {
    target = MARKETING_URL;
    setSessionCookie = 'erp_session=false; Path=/; SameSite=Lax';
  } else {
    // Check cookie for other assets (JS, CSS, static files)
    const cookies = parseCookies(req.headers['cookie']);
    if (cookies['erp_session'] === 'true') {
      target = FRONTEND_URL;
    } else {
      target = MARKETING_URL;
    }
  }
  
  const parsedTarget = new URL(target);
  const headers = { ...req.headers };
  headers['host'] = parsedTarget.host;
  
  const proxyReq = http.request({
    hostname: parsedTarget.hostname,
    port: parsedTarget.port,
    path: req.url,
    method: req.method,
    headers: headers,
  }, (proxyRes) => {
    // Merge the session cookie with target response headers if set
    const responseHeaders = { ...proxyRes.headers };
    if (setSessionCookie) {
      let existingSetCookie = responseHeaders['set-cookie'] || responseHeaders['Set-Cookie'];
      if (Array.isArray(existingSetCookie)) {
        existingSetCookie.push(setSessionCookie);
      } else if (existingSetCookie) {
        existingSetCookie = [existingSetCookie, setSessionCookie];
      } else {
        existingSetCookie = setSessionCookie;
      }
      responseHeaders['Set-Cookie'] = existingSetCookie;
      delete responseHeaders['set-cookie'];
    }
    
    res.writeHead(proxyRes.statusCode, responseHeaders);
    proxyRes.pipe(res, { end: true });
  });
  
  proxyReq.on('error', (err) => {
    console.error(`Proxy error for ${url} -> ${target}:`, err.message);
    res.writeHead(502);
    res.end('Bad Gateway');
  });
  
  req.pipe(proxyReq, { end: true });
});

// Handle WebSocket proxying for Vite HMR
server.on('upgrade', (req, socket, head) => {
  const cookies = parseCookies(req.headers['cookie']);
  const targetPort = cookies['erp_session'] === 'true' ? 5173 : 4000;
  const targetHost = '127.0.0.1';
  
  const headers = { ...req.headers };
  headers['host'] = `${targetHost}:${targetPort}`;
  
  const rawRequest = `GET ${req.url} HTTP/1.1\r\n` +
    Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
    '\r\n\r\n';
    
  const targetSocket = net.connect(targetPort, targetHost, () => {
    targetSocket.write(rawRequest);
    targetSocket.write(head);
    socket.pipe(targetSocket).pipe(socket);
  });
  
  targetSocket.on('error', (err) => {
    console.error(`WS Proxy error for port ${targetPort}:`, err.message);
    socket.destroy();
  });
  socket.on('error', () => {
    targetSocket.destroy();
  });
});

server.listen(9000, '0.0.0.0', () => {
  console.log('Proxy server running on http://localhost:9000');
});
