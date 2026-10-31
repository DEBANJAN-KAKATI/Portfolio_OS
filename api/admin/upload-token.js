/**
 * POST /api/admin/upload-token: Vercel Blob client uploads for large media
 * (videos, 3D models) that don't fit through a serverless request.
 * The browser uploads straight to Blob storage with a short-lived token that is
 * only issued to a Dev Mode session; when the upload finishes, Vercel calls back
 * and the file's real type is checked from its first bytes (wrong type → deleted).
 */
import { handleUpload } from '@vercel/blob/client';
import { del } from '@vercel/blob';
import { route, send, readJson, HttpError } from '../_lib/http.js';
import { requireSession } from '../_lib/session.js';
import { sniff, LIMITS } from '../_lib/files.js';

const ALLOWED = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'model/gltf-binary': 'glb',
  'application/octet-stream': 'glb',
};

export default route(['POST'], async (req, res) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new HttpError(503, 'Large media storage is not configured (BLOB_READ_WRITE_TOKEN).');
  const body = await readJson(req, 64 * 1024);
  const result = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async (pathname) => {
      requireSession(req); // only the token request comes from the browser
      if (!/^(videos|models)\/[a-z0-9][a-z0-9._-]{0,120}\.(mp4|webm|glb)$/.test(pathname)) throw new Error('Path not allowed');
      const isVideo = pathname.startsWith('videos/');
      return {
        allowedContentTypes: Object.keys(ALLOWED).filter((t) => (isVideo ? t.startsWith('video/') : !t.startsWith('video/'))),
        maximumSizeInBytes: isVideo ? LIMITS.video : LIMITS.model,
        addRandomSuffix: true,
      };
    },
    onUploadCompleted: async ({ blob }) => {
      const head = await fetch(blob.url, { headers: { Range: 'bytes=0-63' } });
      const type = sniff(Buffer.from(await head.arrayBuffer()));
      const expected = blob.pathname.split('.').pop();
      if (type !== expected) {
        console.warn(`[upload] removed ${blob.pathname}: content is ${type ?? 'unknown'}`);
        await del(blob.url);
      }
    },
  });
  send(res, 200, result);
});
