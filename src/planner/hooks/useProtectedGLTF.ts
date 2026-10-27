import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MAGIC_SIGNATURE = 'GLBENC01';
const FALLBACK_SEED = 'r3f-limonera-protected-glb-v1-secret';
const DRACO_DECODER_URL = 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/';

const resolvedGltfs = new Map<string, GLTF>();
const pendingLoads = new Map<string, Promise<GLTF>>();
let sharedGltfLoader: GLTFLoader | null = null;

function getGltfLoader(): GLTFLoader {
  if (!sharedGltfLoader) {
    sharedGltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_DECODER_URL);
    sharedGltfLoader.setDRACOLoader(dracoLoader);
  }
  return sharedGltfLoader;
}

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

async function fetchDecryptAndParseGlb(modelPath: string): Promise<GLTF> {
  const existing = resolvedGltfs.get(modelPath);
  if (existing) return existing;

  // 1. Generate a one-time Ephemeral ECDH P-256 keypair with extractable: false
  // The private key cannot be exported even from the browser DevTools Console.
  const clientKeyPair = await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey']
  );

  const clientPubRaw = await window.crypto.subtle.exportKey('raw', clientKeyPair.publicKey);
  const clientPubBase64 = uint8ArrayToBase64(new Uint8Array(clientPubRaw));

  // 2. Request the encrypted binary pack, sending only the ephemeral public key
  const response = await fetch(modelPath, {
    headers: {
      'x-r3f-asset-request': '1',
      'x-r3f-client-pub': clientPubBase64,
    },
  });
  const buffer = await response.arrayBuffer();

  let glbBuffer = buffer;

  if (buffer.byteLength > 36) {
    const headerBytes = new Uint8Array(buffer, 0, 8);
    const headerStr = String.fromCharCode(...headerBytes);

    if (headerStr === MAGIC_SIGNATURE) {
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

  // 4. Parse directly in memory without creating a Blob or blob: URL in the Network tab
  const loader = getGltfLoader();
  const gltf = await new Promise<GLTF>((resolve, reject) => {
    loader.parse(glbBuffer, '', resolve, reject);
  });

  // 5. Immediately wipe decrypted GLB bytes from RAM
  new Uint8Array(glbBuffer).fill(0);

  resolvedGltfs.set(modelPath, gltf);
  return gltf;
}

export function useProtectedGLTF(modelPath: string): GLTF {
  const resolved = resolvedGltfs.get(modelPath);
  if (resolved) return resolved;

  let pending = pendingLoads.get(modelPath);
  if (!pending) {
    pending = fetchDecryptAndParseGlb(modelPath);
    pendingLoads.set(modelPath, pending);
  }
  throw pending;
}

useProtectedGLTF.preload = (modelPath: string) => {
  if (!resolvedGltfs.has(modelPath) && !pendingLoads.has(modelPath)) {
    const p = fetchDecryptAndParseGlb(modelPath);
    pendingLoads.set(modelPath, p);
  }
};
