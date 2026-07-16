// HTTPS 证书自签发 + HTTP/HTTPS 复用端口的 TLS 探测。从 scripts/serve-preview-https.mjs 拆出,
// 逻辑逐字节保留(仅把闭包捕获的顶层常量改为显式参数)。
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import tls from 'node:tls';

export function ensureCertificate({ certDir, certMetaFile, certKeyFile, certFile, localHostname, lanIps, opensslPath }) {
  mkdirSync(certDir, { recursive: true });
  const names = ['localhost', `${localHostname}.local`, ...lanIps];
  const meta = renderCertificateMeta(names);
  const current = existsSync(certMetaFile) ? readFileSync(certMetaFile, 'utf8') : '';
  if (existsSync(certKeyFile) && existsSync(certFile) && certificateMetaMatches(current, meta)) return;

  const config = path.join(certDir, 'openssl.cnf');
  writeFileSync(config, renderOpenSslConfig(names, localHostname));
  execFileSync(opensslPath, [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-sha256',
    '-days',
    '365',
    '-keyout',
    certKeyFile,
    '-out',
    certFile,
    '-config',
    config,
    '-extensions',
    'v3_req',
  ], { stdio: 'ignore' });
  writeFileSync(certMetaFile, meta + '\n');
}

export function renderCertificateMeta(names) {
  return JSON.stringify({ names }, null, 2);
}

export function certificateMetaMatches(current, expected) {
  return current.trim() === expected;
}

export function renderOpenSslConfig(names, localHostname) {
  const altNames = [];
  let dns = 1;
  let ip = 1;
  for (const name of names) {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) altNames.push(`IP.${ip++} = ${name}`);
    else altNames.push(`DNS.${dns++} = ${name}`);
  }
  return `[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn

[dn]
CN = ${localHostname}.local

[v3_req]
subjectAltName = @alt_names
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
${altNames.join('\n')}
`;
}

export function createHttpHttpsMuxServer(plainServer, context) {
  return net.createServer(socket => {
    socket.once('data', chunk => {
      socket.pause();
      socket.unshift(chunk);
      if (isTlsClientHello(chunk)) {
        const tlsSocket = new tls.TLSSocket(socket, { isServer: true, secureContext: context });
        tlsSocket.on('error', () => {});
        tlsSocket.once('secure', () => {
          plainServer.emit('connection', tlsSocket);
        });
        tlsSocket.resume();
        return;
      }
      plainServer.emit('connection', socket);
      socket.resume();
    });
  });
}

export function isTlsClientHello(chunk) {
  return chunk?.[0] === 0x16;
}
