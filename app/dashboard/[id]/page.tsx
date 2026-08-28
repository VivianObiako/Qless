import type { JSX } from "react";
import { OperatorDashboard } from "./OperatorDashboard";

export default async function DashboardPage(
  props: PageProps<"/dashboard/[id]">,
): Promise<JSX.Element> {
  const { id } = await props.params;
  const search = await props.searchParams;

  // The owner token arrives as ?k= so the dashboard link can be bookmarked or
  // opened on the counter tablet. After the first visit the browser has it.
  const tokenParam = search.k;
  const ownerToken = typeof tokenParam === "string" ? tokenParam : null;

  return <OperatorDashboard queueId={id} ownerTokenFromUrl={ownerToken} />;
}

