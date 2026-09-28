import type { JSX } from "react";
import type { Metadata } from "next";
import { AllChairs } from "./AllChairs";

export const metadata: Metadata = {
  title: "All chairs",
};

export default async function AllChairsPage(props: PageProps<"/dashboard/[id]/chairs">): Promise<JSX.Element> {
  const { id } = await props.params;
  return <AllChairs queueId={id} />;
}
