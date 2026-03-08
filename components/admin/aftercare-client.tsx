"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";
import { formatPrice } from "@/lib/utils/format";

const STATUS_OPTIONS = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "IN_PROGRESS",
  "REFUNDED",
  "EXCHANGED",
  "CLOSED",
] as const;

type AftercareCase = {
  id: string;
  status: string;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
  orderNumber: string;
  orderEmail: string;
  orderTotal: string;
};

export function AftercareClient() {
  const toast = useToast();
  const [cases, setCases] = useState<AftercareCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderNumber, setOrderNumber] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/aftercare");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to load aftercare cases");
      }
      setCases(json.data?.cases ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load aftercare cases");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const createCase = async () => {
    try {
      const res = await fetch("/api/admin/aftercare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, reason, notes }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to create case");
      }
      toast.success("Case created");
      setOrderNumber("");
      setReason("");
      setNotes("");
      loadCases();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create case");
    }
  };

  const updateStatus = async (id: string, status: string, nextNotes: string) => {
    try {
      const res = await fetch(`/api/admin/aftercare/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes: nextNotes }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to update case");
      }
      toast.success("Case updated");
      loadCases();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update case");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <Input
          label="Order number"
          value={orderNumber}
          onChange={(event) => setOrderNumber(event.target.value)}
          placeholder="UOOTD-..."
        />
        <Input
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Return request"
        />
        <Input
          label="Notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Customer notes"
        />
      </div>
      <div className="flex gap-3">
        <Button onClick={createCase}>Create case</Button>
        <Button variant="ghost" onClick={loadCases}>
          Refresh
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading aftercare cases...</p>
        ) : cases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No aftercare cases yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="py-2 pr-2">Order</th>
                <th className="py-2 pr-2">Email</th>
                <th className="py-2 pr-2">Total</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Notes</th>
                <th className="py-2 pr-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((caseItem) => (
                <AftercareRow key={caseItem.id} caseItem={caseItem} onSave={updateStatus} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AftercareRow({
  caseItem,
  onSave,
}: {
  caseItem: AftercareCase;
  onSave: (id: string, status: string, notes: string) => void;
}) {
  const [status, setStatus] = useState(caseItem.status);
  const [notes, setNotes] = useState(caseItem.notes ?? "");

  return (
    <tr className="border-b border-border/40 last:border-b-0">
      <td className="py-3 pr-2">
        <div className="flex flex-col">
          <span className="font-medium">{caseItem.orderNumber}</span>
          <span className="text-xs text-muted">{new Date(caseItem.createdAt).toLocaleDateString()}</span>
        </div>
      </td>
      <td className="py-3 pr-2">{caseItem.orderEmail}</td>
      <td className="py-3 pr-2">{formatPrice(Number(caseItem.orderTotal), "USD")}</td>
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
        <input
          className="w-48 rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </td>
      <td className="py-3 pr-2">
        <Button size="sm" onClick={() => onSave(caseItem.id, status, notes)}>
          Save
        </Button>
      </td>
    </tr>
  );
}
