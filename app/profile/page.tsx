import type { JSX } from "react";
import type { Metadata } from "next";
import { Profile } from "./Profile";

export const metadata: Metadata = {
  title: "Profile",
};

// The shell is the screen's own, because which one it gets depends on whether
// this browser holds a session — and only the client knows that.
export default function ProfilePage(): JSX.Element {
  return <Profile />;
}
