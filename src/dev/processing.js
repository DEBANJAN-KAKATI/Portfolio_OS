/**
 * Browser-side processing before anything is uploaded.
 *  - images: resized to ≤ 2560 px, re-encoded as WebP (this drops EXIF/GPS), 480 px thumbnail
 *  - videos: size check + poster frame
 *  - 3D models: test-loaded with three.js + an auto-rendered thumbnail
 *  - PDFs: first page rendered as a preview image
 *  - links: YouTube/Vimeo → video, GitHub repo → project draft, anything else → shortcut
 */
import config from '@config';
import { slugify } from '@/data/adapters/jstmyrb.js';

const MB = 1024 * 1024;
export const LIMITS = { image: config.devMode.maxImageBytes ?? 5 * MB, video: 200 * MB, model: 100 * MB, pdf: 10 * MB, text: 2 * MB };

export const fileSlug = (name) => `${slugify(name.replace(/\.[^.]+$/, '')).replace(/_/g, '-').slice(0, 50) || 'file'}-${Math.random().toString(36).slice(2, 6)}`;

/** What kind of file is this (by type and extension)? */
export function classify(file) {
  const name = file.name.toLowerCase();
  if (/\.(heic|heif)$/.test(name) || /heic|heif/.test(file.type)) return 'heic';
  if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|bmp)$/.test(name)) return 'image';
  if (file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(name)) return 'video';
  if (/\.(glb|gltf)$/.test(name)) return 'model';
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (/\.(md|markdown)$/.test(name) || file.type === 'text/markdown') return 'markdown';
  if (name.endsWith('.json') || file.type === 'application/json') return 'json';
  return 'unknown';
}

const canvasToBlob = (canvas, type = 'image/webp', quality = 0.86) =>
  new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, quality));

function drawScaled(source, w, h, max) {
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function processImage(file, { maxDim = config.devMode.maxImageDimension ?? 2560 } = {}) {
  if (classify(file) === 'heic') throw new Error("HEIC photos can't be read by this browser. Convert to JPG or PNG first (or use Safari).");
  if (file.type === 'image/gif') {
    // Keep animation; GIFs carry no EXIF.
    if (file.size > LIMITS.image) throw new Error(`GIF is larger than ${LIMITS.image / MB} MB.`);
    const bmp = await createImageBitmap(file);
    const thumb = await canvasToBlob(drawScaled(bmp, bmp.width, bmp.height, 480));
    return { full: file, ext: 'gif', thumb, width: bmp.width, height: bmp.height };
  }
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error("This image couldn't be decoded.");
  }
  let quality = 0.86;
  let full = await canvasToBlob(drawScaled(bmp, bmp.width, bmp.height, maxDim), 'image/webp', quality);
  while (full.size > LIMITS.image && quality > 0.5) {
    quality -= 0.12;
    full = await canvasToBlob(drawScaled(bmp, bmp.width, bmp.height, maxDim), 'image/webp', quality);
  }
  if (full.size > LIMITS.image) throw new Error(`Still larger than ${LIMITS.image / MB} MB after compression.`);
  const thumb = await canvasToBlob(drawScaled(bmp, bmp.width, bmp.height, 480), 'image/webp', 0.8);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  return { full, ext: 'webp', thumb, width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) };
}

/** Crop an image blob to an aspect ratio (cx, cy = focus 0..1, zoom ≥ 1) and return WebP. */
export async function cropImage(blob, { aspect, cx = 0.5, cy = 0.5, zoom = 1, maxWidth = 1600 }) {
  const bmp = await createImageBitmap(blob);
  let w = bmp.width / zoom;
  let h = w / aspect;
  if (h > bmp.height / zoom) {
    h = bmp.height / zoom;
    w = h * aspect;
  }
  const x = Math.min(Math.max(0, cx * bmp.width - w / 2), bmp.width - w);
  const y = Math.min(Math.max(0, cy * bmp.height - h / 2), bmp.height - h);
  const outW = Math.min(maxWidth, Math.round(w));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = Math.round(outW / aspect);
  canvas.getContext('2d').drawImage(bmp, x, y, w, h, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas);
}

export async function processVideo(file) {
  if (file.size > LIMITS.video) throw new Error(`Video is larger than ${LIMITS.video / MB} MB.`);
  if (/\.mov$/i.test(file.name) && !document.createElement('video').canPlayType('video/quicktime')) {
    throw new Error('MOV files only play in Safari. Export as MP4 (H.264) first.');
  }
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    video.src = url;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("This video can't be played by the browser."));
    });
    video.currentTime = Math.min(1, video.duration / 10);
    await new Promise((resolve) => (video.onseeked = resolve));
    const poster = await canvasToBlob(drawScaled(video, video.videoWidth, video.videoHeight, 1280), 'image/webp', 0.8);
    const secs = Math.round(video.duration);
    return { poster, duration: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, ext: /\.webm$/i.test(file.name) ? 'webm' : 'mp4' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function processModel(file) {
  if (file.size > LIMITS.model) throw new Error(`Model is larger than ${LIMITS.model / MB} MB.`);
  if (/\.gltf$/i.test(file.name)) throw new Error('Upload a .glb (binary glTF) so textures come with it.');
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const gltf = await new Promise((resolve, reject) => {
    file.arrayBuffer().then((buf) => new GLTFLoader().parse(buf, '', resolve, () => reject(new Error("This model couldn't be loaded."))));
  });
  // Thumbnail: frame the model and render one image.
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setSize(640, 360);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1d24');
  scene.add(new THREE.AmbientLight('#ffffff', 1.2), Object.assign(new THREE.DirectionalLight('#ffffff', 2.5), { position: new THREE.Vector3(3, 5, 4) }));
  scene.add(gltf.scene);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3()).length() || 1;
  const center = box.getCenter(new THREE.Vector3());
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, size / 100, size * 10);
  camera.position.copy(center).add(new THREE.Vector3(size * 0.6, size * 0.4, size * 0.8));
  camera.lookAt(center);
  renderer.render(scene, camera);
  const poster = await canvasToBlob(renderer.domElement, 'image/webp', 0.85);
  renderer.dispose();
  let meshes = 0;
  gltf.scene.traverse((o) => o.isMesh && meshes++);
  return { poster, meshes };
}

export async function processPdf(file) {
  if (file.size > LIMITS.pdf) throw new Error(`PDF is larger than ${LIMITS.pdf / MB} MB.`);
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...head) !== '%PDF-') throw new Error("This isn't a valid PDF.");
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1200 / page.getViewport({ scale: 1 }).width });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvas, viewport }).promise;
  const preview = await canvasToBlob(canvas, 'image/webp', 0.85);
  return { preview, pages: doc.numPages };
}

export async function readMarkdown(file) {
  if (file.size > LIMITS.text) throw new Error('Markdown file is too large.');
  const body = await file.text();
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? file.name.replace(/\.[^.]+$/, '');
  const firstPara = body.replace(/^#.*$/gm, '').split(/\n\s*\n/).map((p) => p.trim()).find((p) => p.length > 20) ?? '';
  return { title, body, description: firstPara.replace(/[*_`#>[\]]/g, '').slice(0, 200) };
}

/** Is this JSON a jstMyRB vault export? */
export async function readVaultJson(file) {
  const data = JSON.parse(await file.text());
  if (!data?.personal_info || !Array.isArray(data.projects)) throw new Error("This JSON isn't a jstMyRB vault export.");
  return data;
}

export function classifyLink(raw) {
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  const host = url.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtube.com' || host === 'youtu.be') {
    const id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') ?? url.pathname.match(/\/(shorts|embed)\/([\w-]+)/)?.[2];
    if (id) return { kind: 'youtube', url: url.href, id };
  }
  if (host === 'vimeo.com' && /^\/\d+/.test(url.pathname)) return { kind: 'vimeo', url: url.href, id: url.pathname.slice(1).split('/')[0] };
  const gh = host === 'github.com' && url.pathname.match(/^\/([\w.-]+)\/([\w.-]+)\/?$/);
  if (gh) return { kind: 'github', url: `https://github.com/${gh[1]}/${gh[2].replace(/\.git$/, '')}`, owner: gh[1], repo: gh[2].replace(/\.git$/, '') };
  return { kind: 'link', url: url.href, host };
}

/** Public repo info for a GitHub link (unauthenticated API). */
export async function fetchRepo(owner, repo) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(res.status === 404 ? 'Repository not found (is it public?).' : `GitHub answered HTTP ${res.status}.`);
  return res.json();
}
