import type { JSX } from "react";
import type { Metadata } from "next";
import { OperatorRoster } from "./OperatorRoster";

export const metadata: Metadata = {
  title: "Your team",
};

// The shell is the screen's own, because which one it gets depends on whether
// this browser holds a session — and only the client knows that.
export default function OperatorsPage(): JSX.Element {
  return <OperatorRoster />;
}
