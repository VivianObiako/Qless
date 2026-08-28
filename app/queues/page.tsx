import type { JSX } from "react";
import type { Metadata } from "next";
import { MyQueues } from "./MyQueues";

export const metadata: Metadata = {
  title: "My queues",
};

// The shell is the screen's own, because which one it gets depends on whether
// this browser holds a session — and only the client knows that.
export default function QueuesPage(): JSX.Element {
  return <MyQueues />;
}
