import crypto from 'node:crypto';
import fs from 'node:fs';
import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAGIC_HEADER = Buffer.from('GLBENC01', 'ascii');
const KEY_SEED = process.env.ASSET_ENCRYPTION_SECRET || 'r3f-limonera-protected-glb-v1-secret';
const STATIC_BUILD_KEY = crypto.createHash('sha256').update(KEY_SEED).digest();

function encryptGlbBuffer(rawBuffer, aesKey = STATIC_BUILD_KEY) {
  if (rawBuffer.length > 8 && rawBuffer.subarray(0, 8).equals(MAGIC_HEADER)) {
    return rawBuffer;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(rawBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([MAGIC_HEADER, iv, encrypted, authTag]);
}

function encryptWithEphemeralEcdh(rawBuffer, clientPubBase64) {
  const clientPubRaw = Buffer.from(clientPubBase64, 'base64');
  const serverEcdh = crypto.createECDH('prime256v1');
  const serverPubRaw = serverEcdh.generateKeys();
  const sharedSecret = serverEcdh.computeSecret(clientPubRaw);

  const payload = encryptGlbBuffer(rawBuffer, sharedSecret);
  sharedSecret.fill(0);

  return {
    payload,
    serverPubBase64: serverPubRaw.toString('base64'),
  };
}

function glbProtectionPlugin() {
  const assetPackMap = new Map();

  return {
    name: 'vite-plugin-glb-protection',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0];
      if (!/\.[jt]sx?$/.test(cleanId) || !code.includes('.glb')) {
        return null;
      }

      const glbImportRegex = /import\s+([A-Za-z0-9_$]+)\s+from\s+['"]([^'"]+\.glb)['"]\s*;?/g;
      let match;
      let transformed = code;
      let hasChanges = false;

      while ((match = glbImportRegex.exec(code)) !== null) {
        const [fullMatch, varName, importPath] = match;
        const resolvedGlbPath = path.resolve(path.dirname(cleanId), importPath);
        if (!fs.existsSync(resolvedGlbPath)) continue;

        const packId =
          crypto.createHash('sha256').update(resolvedGlbPath).digest('hex').slice(0, 16) + '.bin';
        assetPackMap.set(packId, resolvedGlbPath);
        hasChanges = true;

        transformed = transformed.replace(
          fullMatch,
          `const ${varName} = "/api/asset-pack/${packId}";`
        );
      }

      return hasChanges ? { code: transformed, map: null } : null;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();

        const cleanUrl = req.url.split('?')[0];

        if (cleanUrl === '/api/asset-key') {
          res.statusCode = 403;
          res.end('Forbidden: Static key endpoint is disabled. Use Ephemeral ECDH P-256 handshake.');
          return;
        }

        if (cleanUrl.startsWith('/api/asset-pack/')) {
          const clientPubHeader = req.headers['x-r3f-client-pub'];
          if (
            req.headers['x-r3f-asset-request'] !== '1' ||
            typeof clientPubHeader !== 'string' ||
            !clientPubHeader
          ) {
            res.statusCode = 403;
            res.end('Forbidden: Missing Ephemeral ECDH P-256 client public key.');
            return;
          }

          const packId = cleanUrl.slice('/api/asset-pack/'.length);
          const filePath = assetPackMap.get(packId);
          if (filePath && fs.existsSync(filePath)) {
            try {
              const raw = fs.readFileSync(filePath);
              const { payload, serverPubBase64 } = encryptWithEphemeralEcdh(raw, clientPubHeader);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/x-r3f-encrypted');
              res.setHeader('X-Content-Type-Options', 'nosniff');
              res.setHeader('Cache-Control', 'no-store');
              res.setHeader('x-r3f-server-pub', serverPubBase64);
              res.end(payload);
              return;
            } catch {
              res.statusCode = 400;
              res.end('Bad Request: Invalid ECDH P-256 public key.');
              return;
            }
          }
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }

        next();
      });
    },
    generateBundle() {
      // Emit encrypted binary packs at dist/api/asset-pack/<packId> so Cloudflare Worker can serve & re-encrypt them per-request
      for (const [packId, filePath] of assetPackMap.entries()) {
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath);
          const encrypted = encryptGlbBuffer(raw, STATIC_BUILD_KEY);
          this.emitFile({
            type: 'asset',
            fileName: `api/asset-pack/${packId}`,
            source: new Uint8Array(encrypted),
          });
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [basicSsl(), react(), glbProtectionPlugin()],
  assetsInclude: [
    '**/*.gltf',
    '**/*.glb',
    '**/*.bin',
    '**/*.png',
    '**/*.jpg',
    '**/*.jpeg',
    '**/*.svg',
  ],
  server: {
    https: true,
    host: true,
    port: 8002,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        protected: resolve(__dirname, 'vr.html'),
        planner: resolve(__dirname, 'planner.html'),
      },
    },
    minify: 'oxc',
    cssMinify: 'lightningcss',
  },
});
