"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";
import { formatPrice } from "@/lib/utils/format";

type CustomerDetail = {
  id: string;
  email: string;
  name?: string | null;
  tags: string[];
  segment?: string | null;
  source?: string | null;
  utm?: Record<string, unknown> | null;
  preferences?: Record<string, unknown> | null;
  sizes?: Record<string, unknown> | null;
  lifetimeValue: string;
  points: number;
  vipTier?: { name: string } | null;
  orders: Array<{ id: string; orderNumber: string; status: string; total: string; createdAt: string }>;
  notes: Array<{ id: string; note: string; author?: string | null; createdAt: string }>;
  followUps: Array<{ id: string; title: string; status: string; dueAt?: string | null; assignedTo?: string | null }>;
  events: Array<{ id: string; event: string; source?: string | null; metadata?: Record<string, unknown>; occurredAt: string }>;
  subscriptions: Array<{
    id: string;
    type: string;
    active: boolean;
    createdAt: string;
    product?: { titleEn: string; slug: string } | null;
    category?: { nameEn: string; slug: string } | null;
  }>;
};

export function CustomerDetailClient({ customer }: { customer: CustomerDetail }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [followTitle, setFollowTitle] = useState("");
  const [followDueAt, setFollowDueAt] = useState("");
  const [followAssignee, setFollowAssignee] = useState("");

  const addNote = async () => {
    if (!note.trim()) return;
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to add note");
      }
      toast.success("Note added");
      setNote("");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add note");
    }
  };

  const addFollowUp = async () => {
    if (!followTitle.trim()) return;
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: followTitle,
          dueAt: followDueAt || undefined,
          assignedTo: followAssignee || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to add follow-up");
      }
      toast.success("Follow-up created");
      setFollowTitle("");
      setFollowDueAt("");
      setFollowAssignee("");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add follow-up");
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <h2 className="font-display text-xl">Profile</h2>
        <div className="mt-3 grid gap-2 text-sm text-muted">
          <p>Email: <span className="text-ink">{customer.email}</span></p>
          <p>Name: <span className="text-ink">{customer.name ?? "Client"}</span></p>
          <p>Segment: <span className="text-ink">{customer.segment ?? "-"}</span></p>
          <p>Tags: <span className="text-ink">{customer.tags.join(", ") || "-"}</span></p>
          <p>Source: <span className="text-ink">{customer.source ?? "-"}</span></p>
          <p>LTV: <span className="text-ink">{formatPrice(Number(customer.lifetimeValue), "USD")}</span></p>
          <p>Points: <span className="text-ink">{customer.points}</span></p>
          <p>VIP Tier: <span className="text-ink">{customer.vipTier?.name ?? "-"}</span></p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <h2 className="font-display text-xl">Preferences & sizing</h2>
        <div className="mt-3 grid gap-4 text-sm text-muted md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Preferences</p>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-contrast p-3 text-xs text-ink">
              {customer.preferences ? JSON.stringify(customer.preferences, null, 2) : "-"}
            </pre>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Sizes</p>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-contrast p-3 text-xs text-ink">
              {customer.sizes ? JSON.stringify(customer.sizes, null, 2) : "-"}
            </pre>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <h2 className="font-display text-xl">Recent interactions</h2>
        {customer.events.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No events recorded.</p>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            {customer.events.map((event) => (
              <div key={event.id} className="rounded-lg border border-border px-3 py-2">
                <p className="font-medium">{event.event}</p>
                <p className="text-xs text-muted">
                  {event.source ?? "web"} · {new Date(event.occurredAt).toLocaleString()}
                </p>
                {event.metadata && (
                  <pre className="mt-2 whitespace-pre-wrap text-[11px] text-muted">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <h2 className="font-display text-xl">Subscriptions</h2>
        {customer.subscriptions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No subscriptions yet.</p>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            {customer.subscriptions.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="font-medium">{sub.type}</p>
                  <p className="text-xs text-muted">
                    {sub.product?.titleEn ?? sub.category?.nameEn ?? "Global"} · {sub.active ? "Active" : "Paused"}
                  </p>
                </div>
                <span className="text-xs text-muted">{new Date(sub.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <h2 className="font-display text-xl">Recent orders</h2>
        {customer.orders.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No orders found.</p>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            {customer.orders.map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="font-medium">{order.orderNumber}</p>
                  <p className="text-xs text-muted">{order.status}</p>
                </div>
                <div className="text-sm">{formatPrice(Number(order.total), "USD")}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <h2 className="font-display text-xl">Notes</h2>
        <div className="mt-3 space-y-2">
          {customer.notes.length === 0 ? (
            <p className="text-sm text-muted">No notes yet.</p>
          ) : (
            customer.notes.map((noteItem) => (
              <div key={noteItem.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <p className="text-ink">{noteItem.note}</p>
                <p className="text-xs text-muted">{noteItem.author ?? "Admin"}</p>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Input
            label="Add a note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add a customer note"
          />
          <Button onClick={addNote}>Save note</Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <h2 className="font-display text-xl">Follow-up tasks</h2>
        <div className="mt-3 space-y-2 text-sm">
          {customer.followUps.length === 0 ? (
            <p className="text-sm text-muted">No follow-ups yet.</p>
          ) : (
            customer.followUps.map((task) => (
              <div key={task.id} className="rounded-lg border border-border px-3 py-2">
                <p className="font-medium">{task.title}</p>
                <p className="text-xs text-muted">
                  {task.status} {task.dueAt ? `· Due ${new Date(task.dueAt).toLocaleDateString()}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input
            label="Task"
            value={followTitle}
            onChange={(event) => setFollowTitle(event.target.value)}
            placeholder="Follow up on request"
          />
          <Input
            label="Due date"
            type="date"
            value={followDueAt}
            onChange={(event) => setFollowDueAt(event.target.value)}
          />
          <Input
            label="Assigned to"
            value={followAssignee}
            onChange={(event) => setFollowAssignee(event.target.value)}
            placeholder="advisor@brand.com"
          />
        </div>
        <Button className="mt-3" onClick={addFollowUp}>
          Add follow-up
        </Button>
      </section>
    </div>
  );
}
