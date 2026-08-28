import type { JSX } from "react";
import type { Metadata } from "next";
import { PrintSheet } from "./PrintSheet";

export const metadata: Metadata = {
  title: "Print sheet",
  robots: { index: false, follow: false },
};

export default async function PrintSheetPage(
  props: PageProps<"/print/[slug]">,
): Promise<JSX.Element> {
  const { slug } = await props.params;
  return <PrintSheet slug={slug} />;
}

