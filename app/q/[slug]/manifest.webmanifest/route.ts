import manifest from "@/app/manifest";

/**
 * A customer who adds a queue to the Home Screen should land back on that
 * queue, not on the owner's list the site-wide manifest opens.
 */
export async function GET(_request: Request, context: RouteContext<"/q/[slug]/manifest.webmanifest">): Promise<Response> {
  const { slug } = await context.params;
  const startUrl = `/q/${encodeURIComponent(slug)}`;
  return Response.json(
    { ...manifest(), id: startUrl, start_url: startUrl },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
