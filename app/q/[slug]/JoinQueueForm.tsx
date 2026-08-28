"use client";

import { useState, type FormEvent, type JSX } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";

interface JoinQueueFormProps {
  onJoin: (name: string) => Promise<boolean>;
  joining: boolean;
}

export function JoinQueueForm({ onJoin, joining }: JoinQueueFormProps): JSX.Element {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter your name to join");
      return;
    }

    setError(null);
    await onJoin(trimmed);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field
        label="Your name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={error}
        placeholder="First name is enough"
        maxLength={60}
        autoComplete="given-name"
        enterKeyHint="go"
        required
      />
      <Button type="submit" variant="paper" fullWidth loading={joining}>
        Take my number
      </Button>
    </form>
  );
}
