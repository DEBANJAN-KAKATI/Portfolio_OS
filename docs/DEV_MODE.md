# Dev Mode

Dev Mode lets you edit the portfolio from inside the OS: add or edit projects, work experience, skills, education, achievements, hobbies, casual works, photos, videos, 3D models, renders, wallpapers and desktop shortcuts, and drag and drop files onto the desktop. Changes are staged in your browser and go live only when you publish.

Visitors never download Dev Mode code. It loads only after a valid login, and the server checks every write against the session cookie and CSRF token.

## Set up locally

1. Create a password (12+ characters). It's typed hidden, twice:

   ```bash
   npm run hash-password -- --env-local
   ```

   This writes `DEV_MODE_PASSWORD_HASH` and `SESSION_SECRET` to `.env.local`, which git ignores. The password itself is never stored.

2. Restart `npm run dev`.

3. On the lock screen, pick the **Developer** account (bottom left) and type the password. Or, from the desktop, open Command Prompt and run `sudo devmode`.

Without `GITHUB_WRITE_TOKEN`, local publishing writes straight into this folder (`content/*.json`, `data/vault.inbox.json`, `public/media/…`) and rebuilds `src/data/generated/`. Review the changes and commit them yourself.

> If you write the hash into a `.env` file by hand, escape every `$` as `\$`. Vite expands `$VARS` in `.env` files, which breaks the hash. `hash-password --env-local` does this for you. In the Vercel dashboard, paste the hash as-is.

## Set up on Vercel

Add these under **Vercel → Settings → Environment Variables** (see `.env.example`):

| Variable | What it is |
| --- | --- |
| `DEV_MODE_PASSWORD_HASH` | From `npm run hash-password` (without `--env-local`, it prints the values) |
| `SESSION_SECRET` | Printed by the same command |
| `GITHUB_WRITE_TOKEN` | Fine-grained token for this repo only: Contents and Pull requests, read/write |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate limiting store. Strongly recommended; without it, limits are per serverless instance |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob, for videos and 3D models over ~4 MB |

`portfolio.config.js → sync.reviewMode` picks the default publish mode (`pr` opens a pull request, `commit` commits to the branch). You can switch per publish in Portfolio Studio.

## Using it

- **Watermark** (bottom right): shows the number of unpublished changes. Click it to open Portfolio Studio.
- **Desktop right-click → New**: quick-add any content type. "Open in Portfolio Studio" opens the full editor.
- **Drag and drop or Ctrl+V** onto the desktop: images, videos, `.glb` models, PDFs (replaces the resume), Markdown (blog post), a jstMyRB vault JSON, and links (YouTube/Vimeo → video, GitHub repo → project, anything else → desktop shortcut). Each item gets a suggested destination. Files that can't be used are listed with the reason.
- **Right-click an item** in Projects, Work Experience, Achievements, Casual Works, Hobbies, Photos or Media Player: edit, rename, hide, feature, duplicate, delete, properties.
- **Desktop icons** (right-click): pin or unpin to the taskbar and Start, or remove from the desktop, for visitors.
- **Portfolio Studio**: every section with search, bulk actions and drag-to-reorder; a live preview; Profile & text; Desktop & Start layout; deleted items (restorable for 30 days); sync; version history; and **Pending changes → Publish**.
- **Command Prompt**: `status`, `add <type>`, `upload`, `publish [message]`, `studio`, `logout`.
- **Browser → Relay**: test your own apps from the server instead of your device. The app sees the server's IP, and your network only sees HTTPS to the portfolio. Only hosts in `portfolio.config.js → devMode.relay.hosts` can be reached (no private addresses, every redirect re-checked, 30 requests a minute), so the site never works as an open proxy. The preview runs no scripts and loads nothing from the site; JavaScript apps are best tested through their API endpoints. For anonymous browsing in general, use Tor Browser or a VPN.

Before upload, images are resized to at most 2560 px and re-encoded as WebP, which strips EXIF and GPS data. The server checks file types by their bytes and only accepts paths under `public/media/…` and `public/resume.pdf`.

## Where edits go

| Content | Stored in |
| --- | --- |
| Projects, work experience, skills, education, achievements | `data/vault.inbox.json`. jstMyRB stays the source of truth: its **Pull from Portfolio** brings these back into the vault. Until then they show as "Pending in vault". |
| Hobbies, casual works, profile text | `content/extras.json` |
| Photos, videos, 3D models, renders, wallpapers | `content/media.json` plus files in `public/media/` (large files in Vercel Blob) |
| Desktop icons, pins, shortcuts, default wallpaper | `content/layout.json` |
| Deleted items | `content/trash.json` |

## Safety notes

- Never commit `.env.local` or paste the password or token anywhere in the frontend.
- A replaced resume PDF is public. Make sure it doesn't contain your phone number.
- Five failed logins from one IP lock login for 15 minutes. Sessions last 12 hours.
- Logging out clears the cookie in that browser. To end every session at once (for example on a lost laptop), change `SESSION_SECRET`.
