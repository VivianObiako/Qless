import type { JSX } from "react";
import type { Metadata } from "next";
import { DisplayBoard } from "./DisplayBoard";

export const metadata: Metadata = {
  title: "Display",
  // A board is for the room it hangs in. Customers reach the queue by scanning
  // the code on it, not by finding this page in a search result.
  robots: { index: false, follow: false },
};

export default async function DisplayPage(props: PageProps<"/display/[slug]">): Promise<JSX.Element> {
  const { slug } = await props.params;
  return <DisplayBoard slug={slug} />;
}
