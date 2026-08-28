import type { JSX } from "react";
import type { Metadata } from "next";
import { QueueSettingsForm } from "./QueueSettingsForm";

export const metadata: Metadata = {
  title: "Queue settings",
};

export default async function QueueSettingsPage(
  props: PageProps<"/dashboard/[id]/settings">,
): Promise<JSX.Element> {
  const { id } = await props.params;

  // The chrome belongs to the client component rather than to this page: it
  // names the queue in its heading, and only the fetch below it knows the name.
  return <QueueSettingsForm queueId={id} />;
}
