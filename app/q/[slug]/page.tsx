import type { JSX } from "react";
import type { Metadata } from "next";
import { CustomerQueue } from "./CustomerQueue";

export async function generateMetadata(props: PageProps<"/q/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return { manifest: `/q/${encodeURIComponent(slug)}/manifest.webmanifest` };
}

export default async function CustomerQueuePage(
  props: PageProps<"/q/[slug]">,
): Promise<JSX.Element> {
  const { slug } = await props.params;
  return <CustomerQueue slug={slug} />;
}
