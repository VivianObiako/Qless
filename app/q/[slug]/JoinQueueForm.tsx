"use client";

import { useState, type FormEvent, type JSX } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Notice } from "@/components/Notice";

interface JoinQueueFormProps {
  onJoin: (name: string) => Promise<boolean>;
  joining: boolean;
  /** The queue asks for a team name, and refuses one already in line. */
  asksTeamName?: boolean;
  /** The code of the last refused join, if any. */
  joinErrorCode?: string;
}

export function JoinQueueForm({ onJoin, joining, asksTeamName = false, joinErrorCode }: JoinQueueFormProps): JSX.Element {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The name the API last refused. Typing clears it, so an old refusal never
  // sits under a name nobody has sent yet.
  const [refused, setRefused] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      setError(asksTeamName ? "Enter your team name to join" : "Enter your name to join");
      return;
    }

    setError(null);
    setRefused(null);
    if (!(await onJoin(trimmed))) setRefused(trimmed);
  }

  const taken = refused !== null && joinErrorCode === "team_name_taken";

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field
        label={asksTeamName ? "Team name" : "Your name"}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setRefused(null);
        }}
        error={error ?? (taken ? `A team called ${refused} is already in the queue.` : null)}
        placeholder={asksTeamName ? "Exactly as you registered it" : "First name is enough"}
        maxLength={60}
        autoComplete={asksTeamName ? "off" : "given-name"}
        enterKeyHint="go"
        required
      />
      <Button type="submit" variant="paper" fullWidth loading={joining}>
        Take my number
      </Button>
      {taken && (
        <Notice title="Already joined?">
          If a teammate already joined, follow their phone. If you are a different team, use the exact name you
          registered with.
        </Notice>
      )}
    </form>
  );
}
