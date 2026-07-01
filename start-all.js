const { spawn } = require('child_process');
const http = require('http');

const processes = [];

function startProcess(name, command, args, options = {}) {
  console.log(`Starting ${name}...`);
  const child = spawn(command, args, { shell: true, ...options });
  
  child.stdout.on('data', (data) => {
    // Clean and split lines for nicer logging
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`[${name}] ${line.trim()}`);
      }
    });
  });
  
  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.error(`[${name}] ERR: ${line.trim()}`);
      }
    });
  });
  
  child.on('close', (code) => {
    console.log(`[${name}] process exited with code ${code}`);
  });
  
  processes.push(child);
  return child;
}

const path = require('path');

// 0. OCR Service
const pythonPath = path.resolve('.venv/Scripts/python.exe');
startProcess('OCR-Service', `"${pythonPath}"`, ['ocr_service.py']);

// 1. Backend
startProcess('Backend', 'npm', ['run', 'dev:backend']);

// 2. Frontend
startProcess('Frontend', 'npm', ['run', 'dev:frontend']);

// 3. Marketing
startProcess('Marketing', 'npm', ['run', 'dev'], { cwd: './marketing' });

// 4. Proxy
startProcess('Proxy', 'node', ['proxy.js']);

// 5. Ngrok
// Run ngrok http 9000
const ngrokPath = path.resolve('./ngrok.exe');
startProcess('Ngrok', `"${ngrokPath}"`, ['http', '9000']);

// Poll ngrok API for public URL
let retries = 0;
const pollInterval = setInterval(() => {
  http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const tunnel = json.tunnels[0];
        if (tunnel && tunnel.public_url) {
          clearInterval(pollInterval);
          console.log('\n======================================================');
          console.log('🎉 SUCCESS: Bütün servisler çalışıyor!');
          console.log(`🔗 ngrok Linkiniz: ${tunnel.public_url}`);
          console.log('======================================================\n');
        }
      } catch (e) {
        // parsing failed or no tunnels yet
      }
    });
  }).on('error', () => {
    // ngrok API not ready yet
    retries++;
    if (retries > 60) {
      clearInterval(pollInterval);
      console.error('Timeout waiting for ngrok API on port 4040. Ngrok may not have started properly.');
    }
  });
}, 1000);

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('Shutting down all processes...');
  clearInterval(pollInterval);
  processes.forEach((p) => p.kill());
  process.exit(0);
});
