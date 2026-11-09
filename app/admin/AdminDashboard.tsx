"use client";

import { useCallback, useEffect, useState, type FormEvent, type JSX } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { MonoLabel } from "@/components/Label";
import { Notice } from "@/components/Notice";
import { QueueArranging } from "@/components/QueueArranging";
import { Wordmark } from "@/components/Wordmark";
import { useIsClient, useStoredValue } from "@/hooks/useStoredValue";
import { ApiError, getAdminStats } from "@/lib/api";
import { removeSession, writeSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { AdminResponse } from "@/lib/types";

const adminKeyStorage = "qless.admin.token";

export function AdminDashboard(): JSX.Element {
  const isClient = useIsClient();
  const adminKey = useStoredValue(adminKeyStorage);
  const [data, setData] = useState<AdminResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (key: string, signal?: AbortSignal): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setData(await getAdminStats(key, signal));
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (caught instanceof ApiError && caught.status === 401) {
        removeSession(adminKeyStorage);
        setError("That admin key is not right.");
      } else if (caught instanceof ApiError && caught.status === 404) {
        setError("The admin route is off. Set ADMIN_TOKEN on the API in Render.");
      } else {
        setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminKey) return;
    const controller = new AbortController();
    // Loading here is the point of the effect: the key just became available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(adminKey, controller.signal);
    return () => controller.abort();
  }, [adminKey, load]);

  function signOut(): void {
    removeSession(adminKeyStorage);
    setData(null);
  }

  return (
    <div className="min-h-dvh bg-shell">
      <header className="border-b border-shell-mid">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <Wordmark />
            <MonoLabel size={10} tone="muted" className="hidden sm:inline">
              Admin
            </MonoLabel>
          </div>
          {adminKey && (
            <div className="flex shrink-0 gap-2 whitespace-nowrap">
              <Button variant="ghost" size="sm" onClick={() => void load(adminKey)} loading={loading}>
                Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-10">
        {!isClient ? null : !adminKey ? (
          <KeyForm error={error} />
        ) : error ? (
          <Notice tone="standing" title="Couldn't load the numbers" chip="!">
            {error}
          </Notice>
        ) : !data ? (
          <QueueArranging label="Loading the numbers" />
        ) : (
          <Overview data={data} />
        )}
      </main>
    </div>
  );
}

function KeyForm({ error }: { error: string | null }): JSX.Element {
  const [value, setValue] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (value.trim()) writeSession(adminKeyStorage, value.trim());
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-5">
      <h1 className="text-[clamp(30px,7vw,40px)] font-medium leading-none tracking-[-0.03em] text-strong">Admin</h1>
      <Field
        label="Admin key"
        type="password"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={error}
        hint="The ADMIN_TOKEN set on the API. This browser remembers it until you sign out."
        autoComplete="off"
        autoFocus
      />
      <Button type="submit" variant="paper" fullWidth>
        Open
      </Button>
    </form>
  );
}

function Overview({ data }: { data: AdminResponse }): JSX.Element {
  const { health, stats } = data;
  const busiest = Math.max(1, ...stats.joinsByDay.map((d) => d.joins));

  return (
    <div className="space-y-10">
      <section aria-labelledby="health-heading">
        <h2 id="health-heading" className="text-[18px] font-medium text-strong">
          Health
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-shell-line bg-shell-line sm:grid-cols-5">
          <Tile label="API" value="Up" />
          <Tile label="Database" value={`${health.databaseMs} ms`} />
          <Tile label="Up for" value={formatUptime(health.uptimeSec)} />
          <Tile label="Version" value={health.commit || "local"} />
          <Tile label="Push alerts" value={health.push ? "On" : "Off"} className="col-span-2 sm:col-span-1" />
        </dl>
      </section>

      <section aria-labelledby="usage-heading">
        <h2 id="usage-heading" className="text-[18px] font-medium text-strong">
          Usage
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-shell-line bg-shell-line sm:grid-cols-5">
          <Tile label="Businesses" value={stats.businesses} />
          <Tile label="Queues" value={stats.queues} />
          <Tile label="New queues, 7 days" value={stats.queuesLast7d} />
          <Tile label="New queues, 30 days" value={stats.queuesLast30d} />
          <Tile label="Queues used, 7 days" value={stats.activeQueues7d} />
          <Tile label="Joins, 7 days" value={stats.joinsLast7d} />
          <Tile label="Joins, 30 days" value={stats.joinsLast30d} />
          <Tile label="Served, 30 days" value={stats.servedLast30d} />
          <Tile label="Waiting now" value={stats.waitingNow} />
          <Tile label="Alert subscribers" value={stats.pushSubscribers} />
        </dl>
      </section>

      <section aria-labelledby="days-heading">
        <h2 id="days-heading" className="text-[18px] font-medium text-strong">
          Joins, last 14 days
        </h2>
        <ol className="mt-4 flex h-40 items-end gap-1.5 rounded-[12px] border border-shell-line p-4">
          {stats.joinsByDay.map((day) => (
            <li key={day.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-[11px] tabular-nums text-muted">{day.joins}</span>
              <span
                className="w-full rounded-t-[3px] bg-strong"
                style={{ height: `${(day.joins / busiest) * 100}%`, minHeight: day.joins ? 2 : 0 }}
                aria-label={`${day.joins} joins on ${day.day}`}
              />
              <span className="text-[10px] text-muted">{day.day.slice(8)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="queues-heading">
        <h2 id="queues-heading" className="text-[18px] font-medium text-strong">
          Queues by joins, last 30 days
        </h2>
        {stats.topQueues.length === 0 ? (
          <p className="mt-4 text-[14px] text-muted">No queues yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-[12px] border border-shell-line">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead className="text-[12px] text-muted">
                <tr>
                  <th className="px-4 py-3 font-normal">Queue</th>
                  <th className="px-4 py-3 text-right font-normal">Joins</th>
                  <th className="px-4 py-3 font-normal">Last join</th>
                  <th className="px-4 py-3 font-normal">Created</th>
                </tr>
              </thead>
              <tbody>
                {stats.topQueues.map((queue) => (
                  <tr key={queue.slug} className="border-t border-shell-line">
                    <td className="px-4 py-3">
                      <a href={`/q/${queue.slug}`} target="_blank" rel="noopener noreferrer" className="text-strong hover:underline">
                        {queue.name}
                      </a>
                      {queue.archivedAt && <span className="ml-2 text-[12px] text-muted">archived</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-strong">{queue.joins30d}</td>
                    <td className="px-4 py-3 text-dim">{queue.lastJoinAt ? formatDate(queue.lastJoinAt) : "Never"}</td>
                    <td className="px-4 py-3 text-dim">{formatDate(queue.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, className }: { label: string; value: string | number; className?: string }): JSX.Element {
  return (
    <div className={cn("bg-shell px-4 py-4", className)}>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="numeral mt-1.5 text-[24px] text-strong">{value}</dd>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} d`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
