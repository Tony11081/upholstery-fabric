"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

const STATUS_OPTIONS = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELED"] as const;

type ConciergeRequest = {
  id: string;
  name?: string | null;
  email: string;
  phone?: string | null;
  channel?: string | null;
  preferredAt?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
};

export function ConciergeClient() {
  const toast = useToast();
  const [requests, setRequests] = useState<ConciergeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/concierge");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to load requests");
      }
      setRequests(json.data?.requests ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load requests");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const updateRequest = async (id: string, status: string, notes: string) => {
    try {
      const res = await fetch(`/api/admin/concierge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to update request");
      }
      toast.success("Request updated");
      loadRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update request");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={loadRequests}>
          Refresh
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading consultation requests...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No concierge requests yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="py-2 pr-2">Client</th>
                <th className="py-2 pr-2">Channel</th>
                <th className="py-2 pr-2">Preferred</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Notes</th>
                <th className="py-2 pr-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((item) => (
                <ConciergeRow key={item.id} item={item} onSave={updateRequest} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ConciergeRow({
  item,
  onSave,
}: {
  item: ConciergeRequest;
  onSave: (id: string, status: string, notes: string) => void;
}) {
  const [status, setStatus] = useState(item.status);
  const [notes, setNotes] = useState(item.notes ?? "");

  return (
    <tr className="border-b border-border/40 last:border-b-0">
      <td className="py-3 pr-2">
        <div className="flex flex-col">
          <span className="font-medium">{item.name ?? "Client"}</span>
          <span className="text-xs text-muted">{item.email}</span>
          <span className="text-xs text-muted">{item.phone ?? ""}</span>
        </div>
      </td>
      <td className="py-3 pr-2">{item.channel ?? "Email"}</td>
      <td className="py-3 pr-2">
        {item.preferredAt ? new Date(item.preferredAt).toLocaleString() : "Flexible"}
      </td>
      <td className="py-3 pr-2">
        <select
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </td>
      <td className="py-3 pr-2">
        <Input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Add notes"
        />
      </td>
      <td className="py-3 pr-2">
        <Button size="sm" onClick={() => onSave(item.id, status, notes)}>
          Save
        </Button>
      </td>
    </tr>
  );
}
