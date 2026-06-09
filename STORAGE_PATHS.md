# S3 Storage Paths

This document describes the S3 path structure used for storing assets in the `assets` bucket.

## Path Structure

### Groups

**Logos:**

```
groups/{groupId}/logos/{uuid}.{ext}
```

**Banners:**

```
groups/{groupId}/banners/{uuid}.{ext}
```

**Examples:**

- `groups/550e8400-e29b-41d4-a716-446655440000/logos/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png`
- `groups/550e8400-e29b-41d4-a716-446655440000/banners/b2c3d4e5-f6a7-8901-bcde-f12345678901.jpg`

**Rationale:**

- Groups have very few assets (typically 1 logo, 1 banner)
- Logos/banners are replaced, not accumulated
- UUID in filename guarantees uniqueness and provides natural distribution
- No date partitioning needed - simple structure is easier to reason about

### Events

**Published Event Flyers (public):**

```
events/published/{eventId}/flyers/{uuid}.{ext}
```

**Draft Event Flyers (private, staging):**

```
events/draft/{uuid}.{ext}
```

**Flyer Submissions (private, staging):**

```
flyer-submissions/{uuid}.{ext}
```

**Examples:**

- `events/published/660e8400-e29b-41d4-a716-446655440001/flyers/c3d4e5f6-a7b8-9012-cdef-123456789012.webp`
- `events/draft/d4e5f6a7-b8c9-0123-def4-234567890123.jpg`
- `flyer-submissions/e5f6a7b8-c9d0-1234-ef56-345678901234.jpg`

**Rationale:**

- Events are scoped and finite
- Each event can have multiple flyer images
- Draft and flyer-submission folders are staging areas for private uploads before publishing
- On publish, files are promoted (copied) from staging → `events/published/`, then the originals are deleted
- Clear private→public boundary enforced by bucket policy

## Promotion Pipeline

```
events/draft/*          ──┐
                          ├──→  events/published/{eventId}/flyers/{uuid}.{ext}
flyer-submissions/*     ──┘
```

When an event's status transitions to `PUBLISHED` (via `createEvent`, `updateEvent`, or `bulkUpdateEventStatus`),
the `promoteDraftFlyers()` function:

1. Copies each staging file to the published path
2. Deletes the staging original
3. Updates the DB `flyer_images` array with clean public URLs

## Public Access Boundaries

### Public (Read-Only via Bucket Policy)

- `groups/*` — All group assets (logos, banners)
- `events/published/*` — All published event flyers

### Private (No Public Access)

- `events/draft/*` — Draft event flyers, accessed via presigned GET URLs
- `flyer-submissions/*` — Scanner uploads, accessed via presigned GET URLs

## Access Control

### Current Implementation

- Public read access via S3 bucket policy for `groups/*` and `events/published/*`
- Private access for `events/draft/*` and `flyer-submissions/*` (not in bucket policy)
- Uploads require authentication via API (presigned URLs)
- Draft previews use presigned GET URLs with 1-hour expiration

### Future Considerations

The current prefix-based public access is fine for now, but consider these improvements as the system scales:

1. **CloudFront CDN** - Add CloudFront distribution in front of S3 for better performance and caching
2. **Signed Cookies** - Use CloudFront signed cookies for per-asset privacy if needed
3. **Per-Asset Access Control** - Implement fine-grained access control if certain assets need to be private

## Cache Headers

All uploaded files include the following cache headers:

```
Cache-Control: public, max-age=31536000, immutable
```

This ensures:

- Long-lived browser caching (1 year)
- Next.js Image component can cache effectively
- UUID filenames are immutable by design, so long cache is safe

## File Size Limits

- Group logos/banners: 5MB max
- Event flyers: 4.5MB max

These limits are enforced:

1. In the API endpoint before generating presigned URLs
2. In client-side validation before upload

## Content Type Validation

All uploads must have a Content-Type starting with `image/`:

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`

This is enforced in the presigned URL generation endpoint.

## URL Generation

Public URLs are generated using the format:

```
https://{bucket-name}.s3.{region}.amazonaws.com/{key}
```

Example:

```
https://afterclass-prod-assets.s3.us-east-1.amazonaws.com/events/published/660e8400-e29b-41d4-a716-446655440001/flyers/c3d4e5f6-a7b8-9012-cdef-123456789012.webp
```
