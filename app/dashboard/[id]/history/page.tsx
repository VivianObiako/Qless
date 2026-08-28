import type { JSX } from "react";
import type { Metadata } from "next";
import { QueueHistory } from "./QueueHistory";

export const metadata: Metadata = {
  title: "Queue history",
};

export default async function QueueHistoryPage(
  props: PageProps<"/dashboard/[id]/history">,
): Promise<JSX.Element> {
  const { id } = await props.params;

  // The chrome belongs to the client component rather than to this page: it
  // names the queue in its heading, and only the fetch below it knows the name.
  return <QueueHistory queueId={id} />;
}
