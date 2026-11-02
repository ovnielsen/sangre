export const MAGIC_SIGNATURE = 'GLBENC01';
export const FALLBACK_SEED = 'r3f-limonera-protected-glb-v1-secret';
export const DRACO_DECODER_URL = 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/';

export interface ProtectedGlbProgressPatch {
  loadedBytes?: number;
  totalBytes?: number;
  stageProgress?: number;
}

export type OnProtectedGlbProgress = (patch: ProtectedGlbProgressPatch) => void;

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getFallbackStaticKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const digest = await window.crypto.subtle.digest(
    'SHA-256',
    encoder.encode(FALLBACK_SEED)
  );
  return window.crypto.subtle.importKey(
    'raw',
    digest,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
}

async function readResponseWithProgress(
  response: Response,
  onProgress?: OnProtectedGlbProgress
): Promise<ArrayBuffer> {
  const contentLengthHeader = response.headers.get('content-length');
  const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) || 0 : 0;

  if (totalBytes > 0) {
    onProgress?.({
      totalBytes,
      stageProgress: 0.05,
    });
  }

  if (!response.body || typeof response.body.getReader !== 'function') {
    const buf = await response.arrayBuffer();
    onProgress?.({
      loadedBytes: buf.byteLength,
      totalBytes: buf.byteLength,
      stageProgress: 0.8,
    });
    return buf;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loadedBytes += value.byteLength;
      const effectiveTotal = totalBytes > 0 ? Math.max(totalBytes, loadedBytes) : 0;
      const downloadFraction =
        effectiveTotal > 0
          ? Math.min(1, loadedBytes / effectiveTotal)
          : Math.min(0.95, loadedBytes / (loadedBytes + 1_500_000));

      onProgress?.({
        loadedBytes,
        totalBytes: effectiveTotal,
        stageProgress: 0.05 + downloadFraction * 0.75,
      });
    }
  }

  const combined = new Uint8Array(loadedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  onProgress?.({
    loadedBytes,
    totalBytes: loadedBytes,
    stageProgress: 0.8,
  });

  return combined.buffer;
}

export async function fetchAndDecryptGlbBuffer(
  modelPath: string,
  onProgress?: OnProtectedGlbProgress
): Promise<ArrayBuffer> {
  // 1. Generate a one-time Ephemeral ECDH P-256 keypair with extractable: false
  // The private key cannot be exported even from the browser DevTools Console.
  const clientKeyPair = await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey']
  );

  const clientPubRaw = await window.crypto.subtle.exportKey('raw', clientKeyPair.publicKey);
  const clientPubBase64 = uint8ArrayToBase64(new Uint8Array(clientPubRaw));

  onProgress?.({ stageProgress: 0.05 });

  // 2. Request the encrypted binary pack, sending only the ephemeral public key
  const response = await fetch(modelPath, {
    headers: {
      'x-r3f-asset-request': '1',
      'x-r3f-client-pub': clientPubBase64,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch protected GLB (${response.status})`);
  }

  const buffer = await readResponseWithProgress(response, onProgress);
  let glbBuffer = buffer;

  if (buffer.byteLength > 36) {
    const headerBytes = new Uint8Array(buffer, 0, 8);
    const headerStr = String.fromCharCode(...headerBytes);

    if (headerStr === MAGIC_SIGNATURE) {
      onProgress?.({ stageProgress: 0.85 });

      const iv = new Uint8Array(buffer, 8, 12);
      const ciphertextWithTag = new Uint8Array(buffer, 20);
      const serverPubBase64 = response.headers.get('x-r3f-server-pub');

      let aesKey: CryptoKey;
      if (serverPubBase64) {
        // 3. Import server's one-time ECDH public key and derive non-extractable AES-256-GCM key
        const serverPubBytes = base64ToUint8Array(serverPubBase64);
        const serverPubKey = await window.crypto.subtle.importKey(
          'raw',
          serverPubBytes,
          { name: 'ECDH', namedCurve: 'P-256' },
          false,
          []
        );
        aesKey = await window.crypto.subtle.deriveKey(
          { name: 'ECDH', public: serverPubKey },
          clientKeyPair.privateKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );
      } else {
        // Fallback for static file preview server without middleware
        aesKey = await getFallbackStaticKey();
      }

      glbBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        ciphertextWithTag
      );
    }
  }

  return glbBuffer;
}
