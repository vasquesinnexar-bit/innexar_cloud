# Admin Panel — Synthetic Grass (US Market)
# Rules, Property & Build Specification

> Este arquivo é a fonte única de verdade para o projeto.
> Todo agente AI ou desenvolvedor deve ler este arquivo antes de escrever qualquer linha de código.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Workflow Rules](#3-workflow-rules)
4. [File & Architecture Rules](#4-file--architecture-rules)
5. [Planning Rules](#5-planning-rules)
6. [Implementation Rules](#6-implementation-rules)
7. [Testing Rules](#7-testing-rules)
8. [Quality Rules](#8-quality-rules)
9. [Documentation Rules](#9-documentation-rules)
10. [Database Schema](#10-database-schema)
11. [Authentication](#11-authentication)
12. [File Storage — Cloudflare R2](#12-file-storage--cloudflare-r2)
13. [API Routes](#13-api-routes)
14. [Admin Panel Pages](#14-admin-panel-pages)
15. [Environment Variables](#15-environment-variables)
16. [Deployment](#16-deployment)
17. [Pixel Injection](#17-pixel-injection)

---

## 1. Project Overview

**Product:** Admin panel for a synthetic grass business targeting the US market.
**Purpose:** Allow the owner to manage all site content, tracking pixels, blog, portfolio, testimonials, images, and form submissions — without developer intervention.

**Market:** United States only. No WhatsApp. Primary contact via forms and phone.

**Paid Traffic Channels:** Google Ads · Meta (Facebook/Instagram Ads)
**Organic Channel:** SEO + Google Search Console

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR + API routes in one repo |
| Language | TypeScript | Type safety end-to-end |
| Styling | Tailwind CSS | No runtime CSS overhead |
| Database | SQLite via Turso | Lightweight, serverless, generous free tier |
| ORM | Drizzle ORM | Type-safe, works natively with SQLite/Turso |
| Auth | Better Auth | Lightweight, no external service, built for Next.js |
| File Storage | Cloudflare R2 | S3-compatible, zero egress fees, self-controlled |
| Deployment | Railway or Fly.io | Simple, cheap, no persistent disk needed |
| Email | Resend | Simple API, free tier for transactional email |
| Rich Text | TipTap | Lightweight headless editor, framework agnostic |

---

## 3. Workflow Rules

These rules govern how every task must be approached. They apply to AI agents and developers equally.

### 3.1 Always plan before coding

```
PLAN → IMPLEMENT → TEST → REVIEW → DOCUMENT
```

- Before writing any code, write a short plan (even as a comment block) describing what you are about to build.
- The plan must answer: What does this do? What files will be created or changed? What can break?
- Never start a new feature while a previous one is incomplete.

### 3.2 One thing at a time

- Complete one module fully before starting the next.
- The build order is:
  1. Scaffold Next.js 14 with TypeScript and Tailwind
  2. Set up Drizzle + Turso with all schemas
  3. Configure Better Auth
  4. Implement R2 upload utility
  5. Build all public API routes
  6. Build all admin API routes
  7. Build admin panel pages (sidebar order)
  8. Wire pixel injection in root layout
  9. Add middleware for route protection
  10. Write tests for all API routes
  11. Final QA pass

### 3.3 Never skip a step

- Do not implement a page before its API route exists.
- Do not implement an API route before its database schema is migrated.
- Do not deploy before the production checklist in section 16 is complete.

### 3.4 Ask before assuming

- If a requirement is ambiguous, stop and ask. Do not guess and implement.
- If a third-party API behavior is unclear, check the official docs before proceeding.

### 3.5 Run, install, and validate until green (mandatory)

- **Install dependencies:** Always run `npm install` (or the project’s install command) so the environment is complete and reproducible. Do not assume dependencies are already installed.
- **Keep the environment error-free:** After any change, run lint, build, and tests. Fix any errors before considering the task done. No delivery with red build or failing tests.
- **Execute tests after creating or changing code:** Every feature or fix must be followed by running the full test suite. Add or update tests as required by section 7.
- **Validate everything:** Run `npm run lint`, `npm run build`, and `npm run test`. Resolve all failures.
- **Do not stop until green:** The work is only complete when the test suite is green (all tests passing), the build succeeds with zero TypeScript/lint errors, and the environment runs without errors. If tests fail, fix the cause and re-run until everything passes.

---

## 4. File & Architecture Rules

### 4.1 File size limit

> **Every file must have fewer than 300 lines.**

- If a file approaches 300 lines, split it before continuing.
- Splitting strategy:
  - API route handlers → extract business logic to `lib/services/`
  - Large components → extract sub-components to `components/`
  - Shared types → move to `types/` or `lib/types.ts`
  - Database queries → move to `lib/queries/`

### 4.2 Folder structure

```
/
├── app/
│   ├── (site)/                 ← public website pages
│   │   ├── page.tsx            ← homepage
│   │   ├── blog/
│   │   └── contact/
│   ├── (admin)/                ← all admin panel pages (protected)
│   │   ├── layout.tsx          ← sidebar + auth guard (< 100 lines)
│   │   ├── dashboard/
│   │   ├── analytics/
│   │   ├── pixels/
│   │   ├── blog/
│   │   ├── images/
│   │   ├── portfolio/
│   │   ├── testimonials/
│   │   ├── forms/
│   │   ├── cta/
│   │   ├── seo/
│   │   ├── settings/
│   │   └── users/
│   ├── api/
│   │   ├── site/               ← public read-only routes
│   │   └── admin/              ← protected CRUD routes
│   └── auth/                   ← Better Auth handlers
├── components/
│   ├── ui/                     ← base design system components
│   ├── admin/                  ← admin-specific components
│   └── site/                   ← public site components
├── lib/
│   ├── db.ts                   ← Drizzle + Turso connection
│   ├── auth.ts                 ← Better Auth config
│   ├── r2.ts                   ← Cloudflare R2 client
│   ├── schema.ts               ← all Drizzle table schemas
│   ├── queries/                ← all DB queries (one file per table)
│   │   ├── blog.ts
│   │   ├── portfolio.ts
│   │   ├── testimonials.ts
│   │   ├── images.ts
│   │   ├── forms.ts
│   │   ├── settings.ts
│   │   ├── seo.ts
│   │   └── users.ts
│   └── services/               ← business logic
│       ├── upload.ts
│       ├── email.ts
│       └── analytics.ts
├── types/
│   └── index.ts                ← shared TypeScript types
├── middleware.ts                ← route protection
└── .env.local
```

### 4.3 Naming conventions

- Files: `kebab-case.ts` — e.g. `blog-post.ts`, `upload-image.ts`
- Components: `PascalCase.tsx` — e.g. `BlogTable.tsx`, `ImageSlot.tsx`
- Functions: `camelCase` — e.g. `getPublicSettings()`, `uploadToR2()`
- DB tables: `snake_case` — e.g. `blog_posts`, `form_submissions`
- Environment variables: `SCREAMING_SNAKE_CASE`
- API route folders: `kebab-case` — e.g. `/api/admin/blog-posts`

### 4.4 No files without a clear owner

- Every file must belong to exactly one layer: UI, API, service, query, or config.
- No business logic in components. Components only render and call handlers.
- No direct DB calls in API route files. Always go through `lib/queries/`.
- No direct R2 calls in API route files. Always go through `lib/services/upload.ts`.

---

## 5. Planning Rules

### 5.1 Before starting any feature

Write this block at the top of the relevant file or in a comment:

```ts
// FEATURE: [name]
// WHAT: [one sentence description]
// FILES CREATED: [list]
// FILES CHANGED: [list]
// DB CHANGES: [migration needed? yes/no — describe]
// RISKS: [what could break]
```

### 5.2 Schema-first

- Database schema must be finalized before any query or API route is written.
- All schema changes require a Drizzle migration file — never edit schema without migrating.
- Migration files must never be deleted.

### 5.3 API contract first

- Define the request/response shape (TypeScript types) before implementing the handler.
- All types go in `types/index.ts`.
- All API responses follow this shape:

```ts
// Success
{ data: T, error: null }

// Error
{ data: null, error: string, code?: string }
```

### 5.4 No premature abstraction

- Do not create a utility function until it is used in at least 2 places.
- Do not create a component until the same UI pattern appears in at least 2 places.
- Duplication is acceptable in the first pass. Abstraction comes after.

---

## 6. Implementation Rules

### 6.1 TypeScript

- **Always TypeScript.** No `.js` files anywhere in the project.
- No `any` type. Use `unknown` and narrow it, or define a proper type.
- Enable strict mode in `tsconfig.json`.
- All function parameters and return types must be explicitly typed.

```ts
// ❌ Wrong
async function getPost(id) {
  return db.query(...)
}

// ✅ Correct
async function getPost(id: number): Promise<BlogPost | null> {
  return db.query(...)
}
```

### 6.2 Data fetching

- **Always use server components for data fetching.** No `useEffect` for loading data.
- Use Next.js server actions for simple form mutations.
- Use API routes for complex mutations (file uploads, multi-step operations).
- Never expose sensitive keys to the client. Analytics, R2, and DB calls are server-only.

### 6.3 API routes

- Every protected route must verify session at the top of the handler:

```ts
const session = await auth.api.getSession({ headers: request.headers })
if (!session) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 })
```

- Return consistent HTTP status codes: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Server Error.
- Validate all input with Zod before touching the database.
- Use Drizzle transactions for operations that touch multiple tables.

### 6.4 Image handling

- Never allow direct client-to-R2 uploads. All uploads go through `/api/admin/*` routes.
- Before uploading to R2: compress to max 1200px wide, quality 80, convert to WebP.
- Store only the R2 public URL in the database — never the full S3 path.
- When deleting a record that has images, always delete the R2 objects first.
- File naming: `{resource}/{id}-{timestamp}.webp`

### 6.5 Error handling

- Every async function must have try/catch.
- Never swallow errors silently — log them server-side and return a meaningful error response.
- User-facing error messages must be human-readable, not stack traces.

```ts
try {
  const result = await doSomething()
  return Response.json({ data: result, error: null })
} catch (err) {
  console.error("[route-name]", err)
  return Response.json({ data: null, error: "Something went wrong" }, { status: 500 })
}
```

### 6.6 Security

- All admin routes protected by middleware and re-checked inside the handler.
- Sanitize all user input before inserting into the database.
- Never log passwords, tokens, or session data.
- CORS: allow only `NEXT_PUBLIC_URL`.
- Rate limit the `/api/site/forms/submit` route — max 5 submissions per IP per hour.

### 6.7 Environment variables

- Never hardcode secrets, URLs, or IDs in source files.
- Never commit `.env.local` to version control.
- Any new environment variable must be added to section 15 of this document.

---

## 7. Testing Rules

### 7.1 What must be tested

Every API route must have at least:
- One test for the happy path (valid input → correct response)
- One test for unauthorized access (no session → 401)
- One test for invalid input (missing fields → 400)

### 7.2 Testing stack

Use **Vitest** for unit and integration tests.

```bash
npm install -D vitest @vitejs/plugin-react
```

### 7.3 Test file location

Test files live next to the code they test:

```
lib/queries/blog.ts
lib/queries/blog.test.ts

app/api/admin/blog/route.ts
app/api/admin/blog/route.test.ts
```

### 7.4 Test naming

```ts
describe("POST /api/admin/blog", () => {
  it("creates a post and returns 201 with the new post", async () => { ... })
  it("returns 401 when no session is present", async () => { ... })
  it("returns 400 when title is missing", async () => { ... })
})
```

### 7.5 Critical paths — must test

- Auth: login, logout, password reset, unauthorized access
- Forms: public submission, rate limiting, email notification trigger
- Images: upload to R2, old image deletion on replace
- Blog: create, publish, slug uniqueness validation
- Settings: pixel values saved and returned correctly

### 7.6 Run tests before every commit

```bash
npm run test
```

No commit is allowed if tests are failing.

---

## 8. Quality Rules

### 8.1 Code review checklist

Before marking any feature complete, verify:

- [ ] No file exceeds 300 lines
- [ ] No `any` types
- [ ] All async functions have try/catch
- [ ] All protected routes verify session
- [ ] All inputs validated with Zod
- [ ] Images compressed before R2 upload
- [ ] No hardcoded secrets or URLs
- [ ] Tests pass
- [ ] No `console.log` left in production code (use `console.error` for real errors only)
- [ ] TypeScript compiles with zero errors (`npm run build`)

### 8.2 Performance

- Images: always use `next/image` with explicit `width` and `height`
- Fonts: use `next/font` — no external font requests
- Analytics: loaded with `strategy="afterInteractive"` — never block rendering
- Pixel scripts: injected with `next/script` — never inline in `<head>`
- Avoid large client bundles — check with `npm run build` and review page sizes

### 8.3 Accessibility

- All images must have `alt` text — enforced by the `alt_text` field in `site_images`
- All form inputs must have associated `<label>` elements
- Admin panel must be keyboard-navigable
- Use semantic HTML elements: `<nav>`, `<main>`, `<section>`, `<article>`, `<button>`

### 8.4 Linting

Run before every commit:

```bash
npm run lint
```

ESLint config must extend `next/core-web-vitals`. Fix all errors. Warnings may be reviewed.

---

## 9. Documentation Rules

### 9.1 This file is the source of truth

- Any change to the project structure, stack, or API must be reflected in this file.
- Do not let this document go stale. Update it in the same PR/commit as the code change.

### 9.2 Every function must have a JSDoc comment

```ts
/**
 * Uploads a file buffer to Cloudflare R2 and returns the public URL.
 * @param file - Buffer of the file to upload
 * @param key - R2 object key (path inside the bucket)
 * @param contentType - MIME type e.g. "image/webp"
 * @returns Public URL of the uploaded file
 */
export async function uploadToR2(
  file: Buffer,
  key: string,
  contentType: string
): Promise<string> { ... }
```

### 9.3 Every API route must have a header comment

```ts
/**
 * GET /api/admin/blog
 * Lists all blog posts including drafts.
 * Protected — requires valid session.
 * Query params: ?status=draft|published&limit=20&offset=0
 */
export async function GET(request: Request) { ... }
```

### 9.4 Complex logic must have inline comments

- Explain *why*, not *what*. The code says what. The comment says why.

```ts
// Compress before upload to keep R2 costs low and page load fast
const compressed = await sharp(buffer).resize(1200).webp({ quality: 80 }).toBuffer()
```

### 9.5 Schema changes

Every Drizzle migration file must have a comment at the top:

```sql
-- Migration: add og_image to page_seo
-- Date: 2025-06-01
-- Reason: OG images needed for social sharing of landing pages
```

---

## 10. Database Schema

Database: **SQLite via Turso**. ORM: **Drizzle**. All timestamps stored as ISO strings.

### users

| Field | Type | Required | Description |
|---|---|---|---|
| id | integer | Yes | Auto-increment primary key |
| email | text | Yes | Unique. Used for login |
| password_hash | text | Yes | Argon2 hash via Better Auth |
| role | text | Yes | `admin` or `editor` |
| created_at | text | Yes | ISO timestamp |

### blog_posts

| Field | Type | Required | Description |
|---|---|---|---|
| id | integer | Yes | Auto-increment primary key |
| title | text | Yes | Post title |
| slug | text | Yes | Unique URL slug |
| content | text | Yes | Rich text (HTML string from TipTap) |
| cover_image | text | No | R2 public URL |
| meta_title | text | No | SEO title tag override |
| meta_description | text | No | SEO meta description |
| status | text | Yes | `draft` or `published` |
| published_at | text | No | ISO timestamp |
| created_at | text | Yes | ISO timestamp |

### portfolio_items

| Field | Type | Required | Description |
|---|---|---|---|
| id | integer | Yes | Auto-increment primary key |
| title | text | Yes | Project title |
| description | text | No | Short description |
| category | text | No | `residential`, `commercial`, or `sports` |
| image_url | text | Yes | Primary R2 image URL |
| before_image_url | text | No | Before photo R2 URL |
| sort_order | integer | Yes | Display order. Default 0 |
| visible | integer | Yes | `1` = visible, `0` = hidden |
| created_at | text | Yes | ISO timestamp |

### testimonials

| Field | Type | Required | Description |
|---|---|---|---|
| id | integer | Yes | Auto-increment primary key |
| name | text | Yes | Customer name |
| location | text | No | e.g. `Austin, TX` |
| photo_url | text | No | R2 URL of customer photo |
| text | text | Yes | Review body |
| rating | integer | Yes | 1 to 5 |
| approved | integer | Yes | `1` = show on site, `0` = hidden |
| sort_order | integer | Yes | Display order |
| created_at | text | Yes | ISO timestamp |

### site_images

| Field | Type | Required | Description |
|---|---|---|---|
| id | integer | Yes | Auto-increment primary key |
| section | text | Yes | `home`, `about`, `services`, `portfolio`, `contact` |
| slot_key | text | Yes | Unique identifier e.g. `home_hero`, `about_team` |
| label | text | Yes | Human label shown in panel e.g. `Hero Banner` |
| url | text | Yes | Current R2 image URL |
| alt_text | text | No | Alt text for SEO and accessibility |
| updated_at | text | Yes | ISO timestamp of last swap |

### form_submissions

| Field | Type | Required | Description |
|---|---|---|---|
| id | integer | Yes | Auto-increment primary key |
| form_type | text | Yes | `contact`, `quote`, or `callback` |
| name | text | Yes | Submitter name |
| email | text | Yes | Submitter email |
| phone | text | No | Phone number |
| message | text | No | Message body |
| metadata | text | No | JSON: page URL, UTM params, IP |
| read | integer | Yes | `1` = read, `0` = new. Default `0` |
| created_at | text | Yes | ISO timestamp |

### settings

Single-row key-value store. Primary key is `key`.

| Key | Description |
|---|---|
| `company_name` | Business name |
| `company_email` | Public contact email |
| `company_phone` | Public phone number |
| `company_address` | Physical address |
| `meta_pixel_id` | Facebook/Instagram pixel ID |
| `google_ads_id` | Google Ads conversion ID |
| `gtm_id` | Google Tag Manager ID (GTM-XXXXXX) |
| `ga4_id` | GA4 Measurement ID (G-XXXXXXXXXX) |
| `gsc_meta_tag` | Google Search Console verification meta tag content |
| `custom_scripts_head` | Raw scripts injected in `<head>` |
| `custom_scripts_body` | Raw scripts injected before `</body>` |
| `cta_primary_text` | Primary CTA button text e.g. "Get a Free Quote" |
| `cta_primary_url` | Primary CTA destination URL |
| `social_facebook` | Facebook page URL |
| `social_instagram` | Instagram profile URL |
| `social_youtube` | YouTube channel URL |
| `social_linkedin` | LinkedIn page URL |
| `notification_email` | Email that receives new form submission alerts |

### page_seo

| Field | Type | Required | Description |
|---|---|---|---|
| page_key | text | Yes | `home`, `about`, `services`, `contact`, `portfolio` |
| title_tag | text | No | Full title tag for the page |
| meta_description | text | No | Meta description |
| og_image | text | No | Open Graph image URL |
| updated_at | text | Yes | ISO timestamp |

---

## 11. Authentication

**Library:** Better Auth v1
**Method:** Email + password only. No OAuth. No public signup.
**Admin creates users** manually from `/admin/users`.

### lib/auth.ts

```ts
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "./db"

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  session: {
    expiresIn: 60 * 60 * 24 * 7,   // 7 days
    updateAge: 60 * 60 * 24,        // refresh if older than 1 day
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_URL!],
})
```

### middleware.ts

```ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  const isAdmin = request.nextUrl.pathname.startsWith("/admin")
  if (isAdmin && !session) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  return NextResponse.next()
}

export const config = { matcher: ["/admin/:path*"] }
```

### Auth Routes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/sign-in` | Public | Login with email + password |
| POST | `/api/auth/sign-out` | Protected | Destroy session |
| POST | `/api/auth/forget-password` | Public | Send reset email |
| POST | `/api/auth/reset-password` | Public | Reset with token |
| GET | `/api/auth/session` | Public | Returns session or null |

---

## 12. File Storage — Cloudflare R2

**Why R2:** S3-compatible. Zero egress fees. Free tier: 10GB storage, 1M writes/month, 10M reads/month. You own the data.

### lib/r2.ts

```ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export async function uploadToR2(
  file: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
  }))
  return `${process.env.R2_PUBLIC_URL}/${key}`
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  }))
}
```

### File Naming Convention

| Resource | Pattern |
|---|---|
| Blog covers | `blog/{slug}-cover.webp` |
| Portfolio main | `portfolio/{id}-main.webp` |
| Portfolio before | `portfolio/{id}-before.webp` |
| Site images | `site/{slot_key}.webp` |
| Testimonial photos | `testimonials/{id}-photo.webp` |

---

## 13. API Routes

### Public Routes — no auth required

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/site/blog` | Published posts. Query: `?limit=&offset=` |
| GET | `/api/site/blog/[slug]` | Single published post |
| GET | `/api/site/portfolio` | Visible portfolio items |
| GET | `/api/site/testimonials` | Approved testimonials |
| GET | `/api/site/images/[section]` | Images for a site section |
| GET | `/api/site/settings` | Public settings (company, CTAs, socials) |
| GET | `/api/site/seo/[page]` | SEO data for a page |
| POST | `/api/site/forms/submit` | Submit a form (rate limited: 5/IP/hour) |

### Admin — Blog

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/blog` | All posts including drafts |
| POST | `/api/admin/blog` | Create post |
| GET | `/api/admin/blog/[id]` | Get single post |
| PUT | `/api/admin/blog/[id]` | Update post |
| DELETE | `/api/admin/blog/[id]` | Delete post + R2 cover image |
| POST | `/api/admin/blog/[id]/image` | Upload or replace cover image |

### Admin — Portfolio

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/portfolio` | All items |
| POST | `/api/admin/portfolio` | Create item |
| PUT | `/api/admin/portfolio/[id]` | Update details and visibility |
| DELETE | `/api/admin/portfolio/[id]` | Delete item + R2 images |
| PATCH | `/api/admin/portfolio/reorder` | Update sort_order for multiple items |
| POST | `/api/admin/portfolio/[id]/image` | Replace main or before image |

### Admin — Testimonials

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/testimonials` | All testimonials |
| POST | `/api/admin/testimonials` | Create |
| PUT | `/api/admin/testimonials/[id]` | Update |
| DELETE | `/api/admin/testimonials/[id]` | Delete |
| PATCH | `/api/admin/testimonials/[id]/approve` | Toggle approved |

### Admin — Site Images

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/images` | All slots grouped by section |
| POST | `/api/admin/images/[slot_key]` | Replace image for a slot |

### Admin — Forms

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/forms` | List submissions. Query: `?form_type=&read=&from=&to=` |
| PATCH | `/api/admin/forms/[id]/read` | Mark as read |
| GET | `/api/admin/forms/export` | Download filtered CSV |
| DELETE | `/api/admin/forms/[id]` | Delete submission |

### Admin — Settings & Pixels

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/settings` | All settings as key-value object |
| PUT | `/api/admin/settings` | Upsert multiple. Body: `{ key: value, ... }` |

### Admin — SEO

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/seo` | All page SEO records |
| PUT | `/api/admin/seo/[page_key]` | Update title, meta description, og_image |

### Admin — Users

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/users` | List users (admin only) |
| POST | `/api/admin/users` | Create user with role |
| PUT | `/api/admin/users/[id]` | Update email or role |
| DELETE | `/api/admin/users/[id]` | Delete (cannot delete own account) |

### Admin — Analytics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/analytics/pages` | Page views from GA4. Query: `?days=30` |
| GET | `/api/admin/analytics/forms` | Form click events |
| GET | `/api/admin/analytics/sources` | Traffic sources breakdown |
| GET | `/api/admin/analytics/devices` | Device breakdown |

---

## 14. Admin Panel Pages

All pages live under `app/(admin)/`. Layout renders sidebar + auth guard.

### /admin/dashboard
- 4 stat cards: visits today, new leads, form clicks, top page
- Last 5 form submissions preview
- Quick links to all sections

### /admin/analytics
- Date range selector: 7d / 30d / 90d / custom
- Bar chart: visits per page
- Pie chart: traffic sources
- Table: pages with views, avg duration, bounce rate
- Table: form events with click count
- Device split bar: mobile vs desktop

### /admin/pixels
- One field per integration: Meta Pixel ID, Google Ads ID, GTM ID, GA4 ID, GSC meta tag
- Custom head scripts textarea
- Custom body scripts textarea
- Saves to `settings` table. No redeploy needed.

### /admin/blog
- Table: all posts with title, status badge, date, actions
- Create/Edit page: title, slug (auto-generated + editable), TipTap editor, cover image, meta title, meta description, status toggle
- Slug validation: unique, URL-safe
- Auto-save draft every 30 seconds

### /admin/images
- Tabs by section: Home / About / Services / Portfolio / Contact
- Each slot: label, current thumbnail, alt text field, Replace button
- Replace: file picker → preview → confirm → upload to R2 → update DB

### /admin/portfolio
- Grid with drag-to-reorder (or up/down arrows)
- Each card: image, title, category, visible toggle, edit/delete
- Edit modal: title, description, category, main image, before image, visibility
- Delete: removes DB record + R2 images

### /admin/testimonials
- Table: name, rating, approved status, date, actions
- Pending reviews: yellow badge + one-click Approve
- Form: name, location, photo, text, rating, approved toggle

### /admin/forms
- Table: form type, name, email, date, read badge
- Filters: form type, date range, read/unread
- Slide-over: full submission detail on row click
- Actions: mark read, delete
- Export CSV button

### /admin/cta
- Primary CTA: text + destination URL
- Secondary CTA: text + URL (optional)
- Live preview of button appearance
- Saves to `settings` table

### /admin/seo
- One row per page: Home, About, Services, Portfolio, Contact
- Inline edit: title tag, meta description, OG image
- Character counters with color indicators (green/yellow/red)
- Blog post SEO is managed in the blog editor

### /admin/settings
- Company name, email, phone, address
- Social links: Facebook, Instagram, YouTube, LinkedIn
- Notification email for form submissions

### /admin/users
- Table: email, role, created date, actions
- Create user: email + password + role
- Delete with confirmation modal
- Cannot delete own account
- Role: `admin` sees everything · `editor` sees blog, images, portfolio, testimonials only

---

## 15. Environment Variables

Create `.env.local` in project root. Never commit this file.

```bash
# App
NEXT_PUBLIC_URL=https://yourdomain.com

# Database — Turso
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=

# Auth — Better Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://yourdomain.com

# File Storage — Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=https://pub-xxxx.r2.dev

# Email — Resend
RESEND_API_KEY=

# Analytics — GA4 Data API (server-side only)
GA4_PROPERTY_ID=
GA4_SERVICE_ACCOUNT_KEY=
```

---

## 16. Deployment

### Railway (recommended)

1. Connect GitHub repo to Railway
2. Set all environment variables in Railway dashboard
3. Railway auto-detects Next.js — no config needed
4. Cost: ~$5/month on Starter plan
5. No persistent disk needed — all files go to R2

### Fly.io (alternative)

1. Add Dockerfile using Next.js standalone output
2. `fly launch` → set secrets → `fly deploy`
3. Free allowance covers low-traffic sites

### Production Checklist

- [ ] `NEXT_PUBLIC_URL` set to production domain
- [ ] R2 bucket CORS configured to allow your domain
- [ ] Custom domain added to R2 public access (not `.r2.dev`)
- [ ] Resend sending domain configured (DNS records added)
- [ ] `BETTER_AUTH_SECRET` set to a random 32-character string
- [ ] First admin user created via `POST /api/admin/users` after deploy
- [ ] All environment variables set in hosting platform
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run test` passes with zero failures
- [ ] `npm run lint` passes with zero errors

---

## 17. Pixel Injection

Pixels are stored in the `settings` table and injected dynamically. No redeploy needed to add or change a pixel.

### How it works

The site root `app/layout.tsx` (server component) fetches settings and renders the appropriate script tags:

```ts
// app/layout.tsx
import { getPublicSettings } from "@/lib/queries/settings"
import Script from "next/script"

export default async function RootLayout({ children }) {
  const settings = await getPublicSettings()

  return (
    <html lang="en">
      <head>
        {settings.gtm_id && (
          <Script id="gtm" strategy="afterInteractive">{`
            (function(w,d,s,l,i){...})(window,document,'script','dataLayer','${settings.gtm_id}');
          `}</Script>
        )}
        {settings.ga4_id && (
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${settings.ga4_id}`}
            strategy="afterInteractive"
          />
        )}
        {settings.gsc_meta_tag && (
          <meta name="google-site-verification" content={settings.gsc_meta_tag} />
        )}
        {settings.custom_scripts_head && (
          <Script id="custom-head" strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: settings.custom_scripts_head }}
          />
        )}
      </head>
      <body>
        {settings.meta_pixel_id && (
          <Script id="meta-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s)...fbq('init','${settings.meta_pixel_id}');fbq('track','PageView');
          `}</Script>
        )}
        {children}
        {settings.custom_scripts_body && (
          <Script id="custom-body" strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: settings.custom_scripts_body }}
          />
        )}
      </body>
    </html>
  )
}
```

---

## 18. First-Time Setup — Install Everything

> Run these commands in order after cloning the repo.
> `npm` must be available. If running on a fresh machine, install Node.js 20+ first.

### 18.1 Check prerequisites

```bash
node -v        # must be 20+
npm -v         # must be 9+
git --version  # any recent version
```

If Node is missing:

```bash
# macOS
brew install node

# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 18.2 Clone and install

```bash
git clone https://github.com/your-org/your-repo.git
cd your-repo
npm install
```

### 18.3 Set up environment variables

```bash
cp .env.example .env.local
# Open .env.local and fill in all values from section 15
```

### 18.4 Install and configure Turso CLI

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Login
turso auth login

# Create database
turso db create synthetic-grass-panel

# Get connection URL and token
turso db show synthetic-grass-panel --url
turso db tokens create synthetic-grass-panel
# Paste these values into .env.local as TURSO_DATABASE_URL and TURSO_AUTH_TOKEN
```

### 18.5 Run database migrations

```bash
# Generate migration from schema
npx drizzle-kit generate

# Apply migrations to Turso
npx drizzle-kit migrate
```

### 18.6 Seed initial data

```bash
# Creates the first admin user and default site_images slots
npx tsx scripts/seed.ts
```

> The seed script must exist at `scripts/seed.ts`. It should:
> - Create one admin user (email + password from env or prompt)
> - Insert all `site_images` slot rows with placeholder URLs
> - Insert default `settings` rows with empty values
> - Insert default `page_seo` rows for all 5 pages

### 18.7 Run the development server

```bash
npm run dev
# App running at http://localhost:3000
# Admin panel at http://localhost:3000/admin
# Login at http://localhost:3000/login
```

### 18.8 Verify everything starts correctly

Open browser and check:
- `http://localhost:3000` — public site loads
- `http://localhost:3000/login` — login form appears
- `http://localhost:3000/admin` — redirects to `/login` (auth guard working)
- Login with seeded credentials → redirects to `/admin/dashboard`

---

## 19. Testing — Run All Tests

### 19.1 Install test dependencies

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom
```

### 19.2 Add test scripts to package.json

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 19.3 Add vitest config — vitest.config.ts

```ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
})
```

### 19.4 Run tests

```bash
# Run all tests once
npm run test

# Watch mode (re-runs on file change)
npm run test:watch

# With coverage report
npm run test:coverage
```

### 19.5 Test coverage targets

| Area | Minimum coverage |
|---|---|
| API routes (admin) | 90% |
| API routes (public) | 90% |
| lib/queries/* | 80% |
| lib/services/* | 80% |
| Auth middleware | 100% |
| Form submission + rate limit | 100% |

### 19.6 Manual QA checklist

Run this before every deploy:

**Auth**
- [ ] Login with correct credentials → redirects to dashboard
- [ ] Login with wrong password → shows error, no redirect
- [ ] Access `/admin` without login → redirects to `/login`
- [ ] Forgot password → email arrives → reset link works

**Blog**
- [ ] Create post as draft → does not appear on public `/blog`
- [ ] Publish post → appears on public `/blog`
- [ ] Duplicate slug → blocked with error message
- [ ] Upload cover image → thumbnail appears in panel and on post

**Images**
- [ ] Replace image in slot → new image appears on site immediately
- [ ] Alt text saved → visible in page source

**Portfolio**
- [ ] Add item → appears in grid
- [ ] Toggle visible off → disappears from public site
- [ ] Reorder items → new order reflected on public site

**Testimonials**
- [ ] Add testimonial → shows as pending (approved = 0)
- [ ] Approve → appears on public site

**Forms**
- [ ] Submit contact form on public site → appears in `/admin/forms` as unread
- [ ] Notification email received at `notification_email` setting address
- [ ] Submit 6 times from same IP in under 1 hour → 6th is blocked (rate limit)

**Pixels**
- [ ] Add Meta Pixel ID → pixel fires on page load (verify in Meta Pixel Helper)
- [ ] Add GA4 ID → events appear in GA4 DebugView
- [ ] Add GTM ID → GTM fires (verify in Tag Assistant)
- [ ] Remove a pixel ID → script no longer injected

**SEO**
- [ ] Set title tag for Home → `<title>` in page source reflects change
- [ ] Set meta description → `<meta name="description">` reflects change

**TypeScript + Lint**
- [ ] `npm run build` completes with zero errors
- [ ] `npm run lint` completes with zero errors

---

## 20. Next Steps — After First Working Version

Once the panel is running locally and all tests pass, follow this sequence:

### Phase 1 — Production deploy (Week 1)

1. Push repo to GitHub (private repository)
2. Connect to Railway or Fly.io
3. Set all environment variables in hosting dashboard
4. Run `npm run build` in CI to catch any type errors early
5. Deploy and verify production URL works
6. Complete the production checklist from section 16
7. Create first real admin user via panel
8. Replace all placeholder images in `/admin/images` with real photos

### Phase 2 — Connect real tracking (Week 1–2)

1. Create Meta Pixel in Facebook Business Manager → paste ID in `/admin/pixels`
2. Create GA4 property → paste Measurement ID in `/admin/pixels`
3. Create GTM container → paste GTM ID → use GTM to fire GA4 events
4. Add Google Search Console verification tag in `/admin/pixels`
5. Connect GA4 property to Google Search Console inside GSC dashboard
6. Verify Meta Pixel fires using Meta Pixel Helper browser extension
7. Verify GA4 fires using GA4 DebugView (real-time events)

### Phase 3 — Content (Week 2)

1. Add all portfolio photos via `/admin/portfolio`
2. Add customer testimonials via `/admin/testimonials` and approve them
3. Write first 2–3 blog posts targeting US keywords (e.g. "artificial grass installation cost")
4. Fill all SEO fields in `/admin/seo` for all 5 pages
5. Set company info and social links in `/admin/settings`
6. Set primary CTA text and URL in `/admin/cta`

### Phase 4 — Paid traffic readiness (Week 2–3)

1. Confirm Meta Pixel is tracking `Lead` event on form submission
   - Add `fbq('track', 'Lead')` inside the form success handler
2. Confirm GA4 is tracking `generate_lead` event on form submission
3. Set up Google Ads conversion tracking using GTM
4. Create UTM-tagged landing page variants for each ad campaign
5. Test full funnel: ad click → landing page → form submit → confirmation → pixel fires

### Phase 5 — Ongoing

| Cadence | Task |
|---|---|
| Weekly | Check `/admin/forms` for new leads |
| Weekly | Review `/admin/analytics` for top pages and traffic sources |
| Monthly | Publish 1–2 new blog posts |
| Monthly | Add new portfolio projects |
| Monthly | Review SEO performance in Google Search Console |
| Quarterly | Audit pixel firing — confirm no events are broken |
| Quarterly | Review and update CTAs based on conversion data |

---

## 21. Known Limitations & Notes for the AI Agent

- `npm` was not available in the environment where this document was generated. The agent must run all `npm install` and `npm run build` commands in the actual project environment.
- The seed script at `scripts/seed.ts` must be created as part of the implementation — it is referenced in section 18 but not yet written.
- The TipTap rich text editor requires additional packages: `npm install @tiptap/react @tiptap/pm @tiptap/starter-kit`
- Image compression before R2 upload requires Sharp: `npm install sharp`
- GA4 Data API server-side requires the Google client library: `npm install @google-analytics/data`
- Rate limiting on form submission requires: `npm install @upstash/ratelimit @upstash/redis` or use an in-memory store for low traffic
- The `before_image_url` field in `portfolio_items` enables a before/after slider on the public site — implement using a lightweight library like `img-comparison-slider` or a pure CSS solution
- Drizzle migrations must never be deleted — treat them like Git history for the database
- The analytics panel (section 7.2) depends on the GA4 Data API being configured. If `GA4_PROPERTY_ID` or `GA4_SERVICE_ACCOUNT_KEY` are missing, the analytics page must show a clear setup prompt instead of an error

---

*Last updated: 2025 — update this file whenever the project structure, stack, or API changes.*
