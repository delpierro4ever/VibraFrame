/**
 * Normalizes a potentially messy URL or path into a clean Supabase storage object path.
 * 
 * Rules:
 * 1. If input is a full URL, extracts the pathname.
 * 2. Removes known Supabase storage prefixes like /storage/v1/object/public/.
 * 3. Removes the bucket name prefix ("vf-event-assets/") if present.
 * 4. Removes leading slashes.
 * 
 * Example:
 * Input: "https://xyz.supabase.co/storage/v1/object/public/vf-event-assets/events/123/bg.png?t=1"
 * Output: "events/123/bg.png"
 */
export function normalizeStoragePath(input: string | null | undefined): string {
    if (!input || typeof input !== "string") return "";

    let path = input.trim();

    // 1. If full URL, extract pathname
    if (path.startsWith("http")) {
        try {
            const url = new URL(path);
            path = decodeURIComponent(url.pathname);
        } catch {
            // if invalid URL, ignore and keep path as is
        }
    }

    // 2. Remove Supabase storage prefixes (common variations)
    // Supabase paths usually look like: /storage/v1/object/public/<bucket>/<path>
    // We want to strip everything up to and including the bucket name, OR just the prefix.

    // Common prefixes to strip
    const prefixes = [
        "/storage/v1/object/public/",
        "/storage/v1/object/sign/",
        "/storage/v1/object/authenticated/",
    ];

    for (const prefix of prefixes) {
        if (path.startsWith(prefix)) {
            path = path.substring(prefix.length);
        }
    }

    // 3. Remove leading slashes
    while (path.startsWith("/")) {
        path = path.substring(1);
    }

    // 4. Remove bucket name prefix "vf-event-assets/" 
    // (Since createSignedUrl expects path *inside* the bucket)
    // Note: The bucket name might be case sensitive, but usually lowercase in Supabase URL
    if (path.startsWith("vf-event-assets/")) {
        path = path.substring("vf-event-assets/".length);
    }

    return path;
}
