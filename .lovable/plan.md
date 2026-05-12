# T-GPT Major Upgrade Plan

I'll split this into 4 phases so each piece can be verified before the next. You can tell me to do all 4 in sequence, or stop after any phase.

## Phase 1 — Auth, Admin & About (quick wins)

**Google login on custom domain + Lovable proxy 404**
- The "Lovable proxy error (404) after Google login" only happens inside the editor preview iframe — it's a known limitation of Lovable's preview proxy and cannot be fixed in app code. It works fine on the published URL.
- For `t-gpt.tigerhost.space` (Cloudflare reverse proxy): switch all OAuth calls to use `window.location.origin` dynamically (already the case) and add the custom domain to the Supabase redirect URL allowlist. I'll show you the exact URL to paste.
- I cannot programmatically set cookie SameSite flags on Supabase's auth cookies — Supabase manages those. What I CAN do: ensure we never hardcode `lovable.app` anywhere and the redirect always uses the originating host.

**Admin system**
- Create admin user `admin2024@gmail.com` / `jabir551233` via SQL (insert into auth.users + assign admin role).
- New separate `/admin-login` page; `/admin` route redirects non-admins to it.
- Fix admin panel to actually show all users' credits (it's currently filtered by RLS — admin policies exist but the query needs to use the admin path correctly). Passwords are NEVER visible — Supabase hashes them and even service-role can't read plaintext. I'll show email + credits + role + last sign-in instead.

**About page**
- Add "Created by Al-Jabir" as owner credit.

**Delete builds**
- Trash button on each builder thread card with confirmation.

## Phase 2 — Animated UI polish

- Framer-motion entrance animation on post-login redirect.
- Typing/shimmer animation while AI streams responses (already partially there — extend it).
- Subtle page transitions.

## Phase 3 — Multi-file Website Builder (Lovable-style)

Rebuild builder with:
- File tree (left): create/rename/delete files — supports `.html`, `.css`, `.js`, `.jsx`, `.tsx`, `.json`, `.md`, images.
- Monaco code editor (center) with syntax highlighting per file.
- Live preview (right) that **starts blank** and only renders once files exist; for React/JSX projects use Sandpack runtime.
- AI generates **multi-file projects** (returns JSON `{files: [{path, content}]}`) and can iteratively edit individual files.
- Database: replace `builder_threads.html/css/js` columns with a `builder_files` table (thread_id, path, content).
- Download whole project as ZIP.

## Phase 4 — Chat enhancements

- **File/image/video upload** in both normal chat and builder chat (Supabase Storage bucket `chat-uploads`, RLS scoped to user).
- **Image generation**: when user asks for an image, call Lovable AI Gateway's `google/gemini-3-pro-image-preview`, render the image inline with a Download button.
- AI vision: forward uploaded images to the model so it can "see" them.

## Technical notes

- New Storage bucket `chat-uploads` (private, user-scoped folders).
- New table `builder_files` replacing the 3 text columns.
- New table `chat_attachments` linking messages → uploaded files.
- Image gen handler at `/api/image` returning base64 PNG → uploaded to storage → URL returned.
- Sandpack (`@codesandbox/sandpack-react`) for React preview, Monaco (`@monaco-editor/react`) for editor, JSZip for downloads.

## Things I will NOT do (and why)
- Show user passwords in admin panel — impossible, they're one-way hashed. I'll surface email/last-sign-in/credits/role instead.
- "Fix" the preview-iframe 404 after Google login — it's a Lovable preview proxy limitation, not your app. Your published site + custom domain will work.
- Cookie SameSite tweaks — Supabase owns those cookies.

---

**Confirm to proceed with Phase 1**, or tell me to run all 4 phases in sequence (will be a long single turn but I'll do it).