/**
 * Videos and 3D models go straight from the browser to Vercel Blob (they're
 * too big for a serverless request). The upload token is only issued to a Dev
 * Mode session (cookie + CSRF header), see api/admin/upload-token.js.
 */
import { upload } from '@vercel/blob/client';
import { getCsrf } from './api.js';

export async function uploadLarge(file, pathname, onProgress) {
  const blob = await upload(pathname, file, {
    access: 'public',
    handleUploadUrl: '/api/admin/upload-token',
    headers: { 'X-CSRF-Token': getCsrf() ?? '' },
    multipart: file.size > 20 * 1024 * 1024,
    onUploadProgress: onProgress ? ({ percentage }) => onProgress(percentage) : undefined,
  });
  return blob.url;
}
