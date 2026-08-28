import type { JSX } from "react";
import { CustomerQueue } from "./CustomerQueue";

export default async function CustomerQueuePage(
  props: PageProps<"/q/[slug]">,
): Promise<JSX.Element> {
  const { slug } = await props.params;
  return <CustomerQueue slug={slug} />;
}
