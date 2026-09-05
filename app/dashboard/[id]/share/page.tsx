import type { JSX } from "react";
import type { Metadata } from "next";
import { ShareQueue } from "./ShareQueue";

export const metadata: Metadata = {
  title: "Share the queue",
};

export default async function ShareQueuePage(
  props: PageProps<"/dashboard/[id]/share">,
): Promise<JSX.Element> {
  const { id } = await props.params;

  // The chrome belongs to the client component rather than to this page: it
  // names the queue in its heading, and only the fetch below it knows the name.
  return <ShareQueue queueId={id} />;
}
