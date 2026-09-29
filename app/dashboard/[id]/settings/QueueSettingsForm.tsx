"use client";

import { useEffect, useState, type FormEvent, type JSX } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AccessNotice } from "@/components/AccessNotice";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { LinkButton } from "@/components/LinkButton";
import { Notice } from "@/components/Notice";
import { QueueArranging } from "@/components/QueueArranging";
import { DashboardChrome } from "../DashboardChrome";
import { ApiError, actOnQueue, getOperatorView, updateQueue } from "@/lib/api";
import { classifyUnauthorized, type AccessOutcome } from "@/lib/access";
import {
  clearSession,
  getSessionRole,
  ownerTokenKey,
  sessionRoleKey,
  sessionTokenKey,
  type SessionRole,
} from "@/lib/session";
import { useIsClient, useStoredValue } from "@/hooks/useStoredValue";
import { cn } from "@/lib/utils";
import { NOUN_LIMIT, nounFor, type CallPhrase, type Queue, type Seat, type ServiceMeasure, type ServingOrder } from "@/lib/types";
import { CALL_PHRASES, CALL_PHRASE_ORDER } from "@/lib/phrases";
import { SeatsTab } from "./SeatsTab";
import { Choice, SaveRow, Section, Switch, measuredHint } from "./parts";

/**
 * The queue's own configuration. Owner-only, and the server says so on every
 * request — this screen being reachable is not what makes it allowed.
 */
export function QueueSettingsForm({ queueId }: { queueId: string }): JSX.Element {
  const isClient = useIsClient();
  const sessionToken = useStoredValue(sessionTokenKey());
  const legacyToken = useStoredValue(ownerTokenKey(queueId));
  const token = sessionToken ?? legacyToken;

  // The same reading the chrome makes to hide this screen's tab, made again
  // here because a tab is not a door: the address can be typed. It decides what
  // is drawn and nothing more — the save below is refused by the server on its
  // own authority, whatever this component renders.
  const isOwner = useStoredValue(sessionRoleKey()) !== "OPERATOR";

  const [queue, setQueue] = useState<Queue | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [measured, setMeasured] = useState<ServiceMeasure>({ minutes: 0, sample: 0 });
  const [arrival, setArrival] = useState<ServiceMeasure>({ minutes: 0, sample: 0 });
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [access, setAccess] = useState<AccessOutcome | null>(null);
  const [endedAs, setEndedAs] = useState<SessionRole | null>(null);

  useEffect(() => {
    // An operator is turned away below rather than by this fetch, so there is
    // nothing to ask for: the entries route would answer them perfectly well,
    // being the same call the counter makes, and the answer would only ever
    // fill in a form they are about to be told they cannot use.
    if (!token || !isOwner) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const view = await getOperatorView(queueId, token, controller.signal);
        setQueue(view.queue);
        setSeats(view.seats);
        setMeasured(view.measured);
        setArrival(view.arrival);
        setLoadError(null);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (!(caught instanceof ApiError)) return;
        setLoadError(caught);

        if (caught.status !== 401) return;

        // An operator never gets this far, so a 401 here is an owner who has
        // wandered onto somebody else's queue, or a session that has stopped
        // working — "not yours" rather than "signed out", and in the first case
        // their session is worth keeping. Only the server can tell those two
        // apart; see classifyUnauthorized.
        const outcome = await classifyUnauthorized(token);
        if (outcome === null) return;
        if (outcome === "session-ended") {
          setEndedAs(getSessionRole());
          clearSession();
        }
        setAccess(outcome);
      }
    })();

    return () => controller.abort();
  }, [queueId, token, isOwner]);

  // The queue is named once, by the chrome, so this screen's own title is an
  // h2 under it rather than a second h1.
  function body(): JSX.Element {
    if (!isClient || (token && !queue && !loadError)) {
      return <QueueArranging className="mx-auto max-w-md" label="Loading settings" />;
    }

    if (access !== null) {
      return <AccessNotice outcome={access} role={endedAs} what="queue" />;
    }

    if (!token || loadError?.status === 401) {
      return (
        <Notice
          tone="standing"
          title="Sign in to change these settings"
          chip="!"
          action={<LinkButton href="/enter">Enter a code</LinkButton>}
        >
          Only the owner of this queue can change its settings.
        </Notice>
      );
    }

    if (loadError || !queue) {
      return (
        <Notice tone="standing" title="Couldn't load this queue" chip="!">
          {loadError?.message ?? "Try again in a moment."}
        </Notice>
      );
    }

    return (
      <Tabs
        queueId={queueId}
        queue={queue}
        seats={seats}
        measured={measured}
        arrival={arrival}
        token={token}
        onSaved={setQueue}
        onSeatsChanged={setSeats}
      />
    );
  }

  return (
    <DashboardChrome
      queueId={queueId}
      tab="settings"
      queueName={queue?.name}
      queueSlug={queue?.slug}
      width="narrow"
    >
      {body()}
    </DashboardChrome>
  );
}

export type SettingsTab = "general" | "seats" | "waiting" | "privacy";

const tabs: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "seats", label: "Seats" },
  { id: "waiting", label: "Waiting" },
  { id: "privacy", label: "Privacy" },
];

function tabFromHash(): SettingsTab {
  if (typeof window === "undefined") return "general";
  const hash = window.location.hash.replace(/^#/, "");
  return tabs.some((tab) => tab.id === hash) ? (hash as SettingsTab) : "general";
}

/**
 * Settings as tabs. Each tab saves on its own; switching away from one with
 * unsaved changes asks first. The tab is kept in the address's hash so the
 * counter can send an owner straight to Seats.
 */
function Tabs({
  queueId,
  queue,
  seats,
  measured,
  arrival,
  token,
  onSaved,
  onSeatsChanged,
}: {
  queueId: string;
  queue: Queue;
  seats: Seat[];
  measured: ServiceMeasure;
  arrival: ServiceMeasure;
  token: string;
  onSaved: (queue: Queue) => void;
  onSeatsChanged: (seats: Seat[]) => void;
}): JSX.Element {
  const [current, setCurrent] = useState<SettingsTab>(() => tabFromHash());
  const [dirty, setDirty] = useState(false);
  const [leavingFor, setLeavingFor] = useState<SettingsTab | null>(null);

  function go(tab: SettingsTab): void {
    if (tab === current) return;
    if (dirty) {
      setLeavingFor(tab);
      return;
    }
    switchTo(tab);
  }

  function switchTo(tab: SettingsTab): void {
    setDirty(false);
    setCurrent(tab);
    window.history.replaceState(null, "", tab === "general" ? window.location.pathname : `#${tab}`);
  }

  return (
    <div>
      <h2 className="text-[clamp(30px,6vw,40px)] font-medium leading-none tracking-[-0.03em] text-strong">
        Settings
      </h2>

      <div role="tablist" aria-label="Settings" className="mt-6 flex gap-5 overflow-x-auto border-b border-shell-line">
        {tabs.map((tab) => {
          const selected = tab.id === current;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`settings-${tab.id}`}
              id={`settings-tab-${tab.id}`}
              onClick={() => go(tab.id)}
              className={cn(
                "-mb-px shrink-0 border-b-2 py-2.5 text-[13.5px] transition-colors pointer-coarse:min-h-11",
                selected ? "border-strong font-medium text-strong" : "border-transparent text-dim hover:text-strong",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`settings-${current}`} aria-labelledby={`settings-tab-${current}`} className="mt-8">
        {current === "general" && (
          <GeneralTab queueId={queueId} queue={queue} token={token} onSaved={onSaved} onDirty={setDirty} />
        )}
        {current === "seats" && (
          <SeatsTab
            queueId={queueId}
            queue={queue}
            seats={seats}
            measured={measured}
            token={token}
            onSaved={onSaved}
            onSeatsChanged={onSeatsChanged}
            onDirty={setDirty}
          />
        )}
        {current === "waiting" && (
          <WaitingTab
            queueId={queueId}
            queue={queue}
            measured={measured}
            arrival={arrival}
            openSeats={seats.filter((seat) => seat.active).length}
            token={token}
            onSaved={onSaved}
            onDirty={setDirty}
          />
        )}
        {current === "privacy" && (
          <PrivacyTab queueId={queueId} queue={queue} token={token} onSaved={onSaved} onDirty={setDirty} />
        )}
      </div>

      <ConfirmDialog
        open={leavingFor !== null}
        onOpenChange={(open) => {
          if (!open) setLeavingFor(null);
        }}
        title="Leave without saving?"
        description="The changes on this tab have not been saved. Save them first, or leave and lose them."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => {
          const next = leavingFor;
          setLeavingFor(null);
          if (next) switchTo(next);
        }}
      />
    </div>
  );
}

interface TabProps {
  queueId: string;
  queue: Queue;
  token: string;
  onSaved: (queue: Queue) => void;
  /** Tells the tab strip whether switching away should ask first. */
  onDirty: (dirty: boolean) => void;
}

/** Saves one tab's fields and reports the outcome the same way on every tab. */
async function save(
  queueId: string,
  token: string,
  input: Parameters<typeof updateQueue>[1],
  onSaved: (queue: Queue) => void,
): Promise<string | null> {
  try {
    const view = await updateQueue(queueId, input, token);
    onSaved(view.queue);
    toast.success("Settings saved");
    return null;
  } catch (caught) {
    return caught instanceof ApiError ? caught.message : "Something went wrong.";
  }
}

function GeneralTab({ queueId, queue, token, onSaved, onDirty }: TabProps): JSX.Element {
  const router = useRouter();
  const [name, setName] = useState(queue.name);
  const [description, setDescription] = useState(queue.description);
  const [personNoun, setPersonNoun] = useState(queue.personNoun);
  const [peopleNoun, setPeopleNoun] = useState(queue.peopleNoun);
  // A server from before the setting sends none; that queue says "serving".
  const [phrase, setPhrase] = useState<CallPhrase>(queue.callPhrase ?? "SERVING");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    onDirty(
      name !== queue.name ||
        description !== queue.description ||
        personNoun !== queue.personNoun ||
        peopleNoun !== queue.peopleNoun ||
        phrase !== (queue.callPhrase ?? "SERVING"),
    );
  }, [name, description, personNoun, peopleNoun, phrase, queue, onDirty]);

  async function archive(): Promise<void> {
    setArchiving(true);
    try {
      await actOnQueue(queueId, "archive", token);
      toast.success(`${queue.name} is archived`);
      router.push("/queues");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Something went wrong.");
      setArchiving(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Enter a name for your queue");
      return;
    }
    setNameError(null);
    setSaving(true);
    // An emptied box is sent empty: the server puts the ordinary word back.
    setError(
      await save(
        queueId,
        token,
        {
          name: trimmedName,
          description: description.trim(),
          personNoun: personNoun.trim(),
          peopleNoun: peopleNoun.trim(),
          callPhrase: phrase,
        },
        (saved) => {
          setPersonNoun(saved.personNoun);
          setPeopleNoun(saved.peopleNoun);
          onSaved(saved);
        },
      ),
    );
    setSaving(false);
  }

  return (
    <div>
      <form onSubmit={onSubmit} noValidate>
        <Section title="Queue" description="What customers see when they scan in.">
          <Field
            label="Business or queue name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={nameError}
            hint="Changing this does not change your queue's link."
            maxLength={80}
            required
          />
          <Field
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            hint="Optional. Shown to customers when they join."
            placeholder="Walk-ins welcome"
            maxLength={200}
          />
        </Section>

        <Section
          title="Wording"
          description="The words on phones, the wall and the join page. Your counter keeps its own."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="One"
              value={personNoun}
              onChange={(event) => setPersonNoun(event.target.value)}
              placeholder="customer"
              hint="guest, participant, team"
              maxLength={NOUN_LIMIT}
            />
            <Field
              label="More than one"
              value={peopleNoun}
              onChange={(event) => setPeopleNoun(event.target.value)}
              placeholder="customers"
              hint="guests, participants, teams"
              maxLength={NOUN_LIMIT}
            />
          </div>
          <Choice<CallPhrase>
            label="When someone is called"
            value={phrase}
            onChange={setPhrase}
            options={CALL_PHRASE_ORDER.map((value) => {
              const wording = CALL_PHRASES[value];
              return {
                value,
                label: wording.label,
                description: `For ${wording.suits}. The wall says "${wording.now}", and after their turn a ${nounFor({ personNoun, peopleNoun }, 1)} is told "${wording.doneTitle}".`,
              };
            })}
          />
        </Section>

        <SaveRow error={error} saving={saving} />
      </form>

      {/* Wrapped so the section is a first child and draws no hairline of
          its own: the save row above already has one. */}
      <div className="mt-14">
        <Section title="Archive" description="Put this queue away. Nothing is deleted.">
          <div>
            <p className="text-[13.5px] leading-[1.6] text-dim">
              An archived queue closes, leaves your list and stops taking joins. Its history stays, and
              you can restore it from your queues at any time.
            </p>
            <Button variant="ghost" size="md" className="mt-4" onClick={() => setConfirmingArchive(true)}>
              Archive this queue
            </Button>
          </div>
        </Section>
      </div>

      <ConfirmDialog
        open={confirmingArchive}
        onOpenChange={setConfirmingArchive}
        title={`Archive ${queue.name}?`}
        description="It closes and leaves your list. Everyone waiting keeps their number but nobody new can join, and the print sheet on the door stops working until you restore it."
        confirmLabel="Archive"
        cancelLabel="Keep it"
        destructive
        loading={archiving}
        onConfirm={() => void archive()}
      />
    </div>
  );
}

/**
 * The three ways a queue can run, as one choice. Two settings sit behind it:
 * how numbers are given out, and who is called next. Random numbers called at
 * random is not offered: a draw over a draw.
 */
type HowItWorks = "IN_ORDER" | "RANDOM_NUMBERS" | "RANDOM_CALL";

function howItWorksOf(queue: Queue): HowItWorks {
  if (queue.servingOrder === "RANDOM") return "RANDOM_CALL";
  if (queue.numbering === "RANDOM") return "RANDOM_NUMBERS";
  return "IN_ORDER";
}

function WaitingTab({
  queueId,
  queue,
  measured,
  arrival,
  openSeats,
  token,
  onSaved,
  onDirty,
}: TabProps & { measured: ServiceMeasure; arrival: ServiceMeasure; openSeats: number }): JSX.Element {
  const [serviceMinutes, setServiceMinutes] = useState(String(queue.averageServiceMinutes));
  const [capacity, setCapacity] = useState(queue.maxCapacity === null ? "" : String(queue.maxCapacity));
  const [holdMinutes, setHoldMinutes] = useState(String(queue.holdMinutes));
  const [mode, setMode] = useState<HowItWorks>(howItWorksOf(queue));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const draw = mode === "RANDOM_CALL";
  const randomNumbers = mode === "RANDOM_NUMBERS";
  const fixedPlaces = draw || randomNumbers;
  const people = nounFor(queue, 2);
  const person = nounFor(queue, 1);
  const People = people.charAt(0).toUpperCase() + people.slice(1);

  useEffect(() => {
    onDirty(
      serviceMinutes !== String(queue.averageServiceMinutes) ||
        capacity !== (queue.maxCapacity === null ? "" : String(queue.maxCapacity)) ||
        holdMinutes !== String(queue.holdMinutes) ||
        mode !== howItWorksOf(queue),
    );
  }, [serviceMinutes, capacity, holdMinutes, mode, queue, onDirty]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const minutes = Number.parseInt(serviceMinutes, 10);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 480) {
      setError("Average service time must be between 1 and 480 minutes.");
      return;
    }

    const parsedCapacity = capacity.trim() === "" ? null : Number.parseInt(capacity, 10);
    const capacityValid = parsedCapacity !== null && Number.isFinite(parsedCapacity) && parsedCapacity >= 1 && parsedCapacity <= 1000;
    if (fixedPlaces && !capacityValid) {
      setCapacityError(
        draw
          ? "A draw needs a fixed number of places, from 1 to 1000."
          : "Random numbers need a fixed number of places, from 1 to 1000.",
      );
      return;
    }
    if (parsedCapacity !== null && !capacityValid) {
      setCapacityError("Maximum queue size must be a whole number from 1 to 1000, or left empty for no limit.");
      return;
    }
    setCapacityError(null);

    const hold = holdMinutes.trim() === "" ? 0 : Number.parseInt(holdMinutes, 10);
    if (!Number.isFinite(hold) || hold < 0 || hold > 120) {
      setError("Hold time must be between 0 and 120 minutes.");
      return;
    }

    setSaving(true);
    setError(null);
    // Capacity is always sent, including as null: null is how "no limit" is
    // expressed, and leaving it out would mean "don't change it".
    setError(
      await save(
        queueId,
        token,
        {
          averageServiceMinutes: minutes,
          maxCapacity: parsedCapacity,
          holdMinutes: hold,
          // Sent together, so the queue never passes through a combination
          // the server refuses on the way from one mode to another.
          servingOrder: draw ? "RANDOM" : "IN_ORDER",
          numbering: randomNumbers ? "RANDOM" : "SEQUENTIAL",
        },
        onSaved,
      ),
    );
    setSaving(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Section title="How it works" description="How numbers are given out, and who is called next.">
        <Choice<HowItWorks>
          label="Numbers and calling"
          value={mode}
          onChange={(next) => {
            setMode(next);
            setCapacityError(null);
          }}
          options={[
            {
              value: "IN_ORDER",
              label: "In order",
              description: `First come, first called. The lowest number goes next, and ${people} see their place in line and an estimated wait.`,
            },
            {
              value: "RANDOM_NUMBERS",
              label: "Random numbers",
              description: `Each ${person} who joins gets a random number from 1 to the number of places, then ${people} are called from the lowest number up. Pause the queue once everyone has a number, so nobody joins with a low number after the first call.`,
            },
            {
              value: "RANDOM_CALL",
              label: "Random call",
              description:
                "A draw. Everyone with a number is in it, each call picks one at random, and the next is drawn ahead so they get warning. There is no wait estimate, and the number of places is fixed.",
            },
          ]}
        />
      </Section>

      <Section
        title={fixedPlaces ? "Places" : "Waiting"}
        description={
          draw
            ? "How many numbers the draw hands out. Nobody can join once they are gone."
            : randomNumbers
              ? "The numbers to give out. Nobody can join once they are gone."
              : `The estimate ${people} see, and how long the line can get.`
        }
      >
        {/* A draw quotes no wait, so the figure that builds one is kept but
            not asked for. Switching back brings it back as it was. */}
        {!draw && (
          <Field
            label="Average service time"
            type="number"
            inputMode="numeric"
            value={serviceMinutes}
            onChange={(event) => setServiceMinutes(event.target.value)}
            hint={measuredHint(measured, openSeats)}
            suffix="minutes"
            min={1}
            max={480}
            required
          />
        )}
        <Field
          label={fixedPlaces ? "Number of places" : "Maximum queue size"}
          type="number"
          inputMode="numeric"
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          error={capacityError}
          hint={
            randomNumbers
              ? `Numbers run from 1 to ${capacity.trim() || "this"}. Raise this if someone was missed.`
              : draw
                ? `Everyone gets a number. Raise this if someone was missed. ${
                    queue.servingOrder === "RANDOM" ? "" : "Anyone already waiting counts toward it."
                  }`.trim()
                : "Optional. Leave empty for no limit."
          }
          placeholder={fixedPlaces ? undefined : "No limit"}
          suffix={people}
          min={1}
          max={1000}
          required={draw}
        />
      </Section>

      <Section title="Holding a place" description="What happens when someone is called and isn't there.">
        <Field
          label="Hold time"
          type="number"
          inputMode="numeric"
          value={holdMinutes}
          onChange={(event) => setHoldMinutes(event.target.value)}
          hint="After this long the counter suggests a skip, a skipped number can still be called back for this long, and customers are told the figure. 0 means no hold: a skip is final."
          suffix="minutes"
          min={0}
          max={120}
        />
        <p className="text-[13px] leading-[1.6] text-dim">
          {arrivalHint(arrival, Number.parseInt(holdMinutes, 10))}
        </p>
      </Section>

      <SaveRow error={error} saving={saving} />
    </form>
  );
}

function PrivacyTab({ queueId, queue, token, onSaved, onDirty }: TabProps): JSX.Element {
  const [showNames, setShowNames] = useState(queue.showNamesToOperators);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onDirty(showNames !== queue.showNamesToOperators);
  }, [showNames, queue.showNamesToOperators, onDirty]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(await save(queueId, token, { showNamesToOperators: showNames }, onSaved));
    setSaving(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Section title="Privacy" description="Who sees customer names. Customers never see each other's.">
        <Switch
          label="Show customer names to operators"
          description="You always see names. Operators see numbers only unless this is on — a barbershop probably wants it, a clinic probably does not."
          checked={showNames}
          onChange={setShowNames}
        />
      </Section>

      <SaveRow error={error} saving={saving} />
    </form>
  );
}

/**
 * How long people have been taking to turn up once called, set against the
 * hold time being typed, so the owner can see whether the two agree.
 */
function arrivalHint(arrival: ServiceMeasure, hold: number): string {
  if (arrival.sample === 0) {
    return "Once people have been called and served, this will say how long they take to arrive, which is what the hold time should be longer than.";
  }
  const lately = `Lately people have taken about ${arrival.minutes} min to arrive once called, across the last ${arrival.sample} served.`;
  if (Number.isFinite(hold) && hold > 0 && hold < arrival.minutes) {
    return `${lately} That is longer than this hold time, so people on their way will be skipped.`;
  }
  return lately;
}

