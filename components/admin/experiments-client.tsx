"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

const STATUS_OPTIONS = ["DRAFT", "RUNNING", "PAUSED", "COMPLETED"] as const;

type Experiment = {
  id: string;
  name: string;
  slug: string;
  status: string;
  variants: unknown;
  assignments: number;
  events: number;
};

export function ExperimentsClient() {
  const toast = useToast();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [variants, setVariants] = useState("control, variant_a");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("DRAFT");

  const loadExperiments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/experiments");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to load experiments");
      }
      setExperiments(json.data?.experiments ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load experiments");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  const createExperiment = async () => {
    try {
      const res = await fetch("/api/admin/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
          variants,
          status,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to create experiment");
      }
      toast.success("Experiment created");
      setName("");
      setSlug("");
      setVariants("control, variant_a");
      setStatus("DRAFT");
      loadExperiments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create experiment");
    }
  };

  const updateExperiment = async (id: string, nextStatus: string) => {
    try {
      const res = await fetch(`/api/admin/experiments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to update experiment");
      }
      toast.success("Experiment updated");
      loadExperiments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update experiment");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <Input label="Slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
        <Input
          label="Variants (comma separated)"
          value={variants}
          onChange={(event) => setVariants(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex flex-col gap-2 text-sm text-ink">
          <span className="font-medium text-ink">Status</span>
          <select
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
            value={status}
            onChange={(event) => setStatus(event.target.value as (typeof STATUS_OPTIONS)[number])}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={createExperiment}>Create experiment</Button>
        <Button variant="ghost" onClick={loadExperiments}>
          Refresh
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading experiments...</p>
        ) : experiments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No experiments yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="py-2 pr-2">Experiment</th>
                <th className="py-2 pr-2">Variants</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Assignments</th>
                <th className="py-2 pr-2">Events</th>
                <th className="py-2 pr-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {experiments.map((experiment) => (
                <ExperimentRow key={experiment.id} experiment={experiment} onUpdate={updateExperiment} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ExperimentRow({
  experiment,
  onUpdate,
}: {
  experiment: Experiment;
  onUpdate: (id: string, status: string) => void;
}) {
  const [status, setStatus] = useState(experiment.status);
  const variantsText = Array.isArray(experiment.variants)
    ? experiment.variants.map((variant) => (typeof variant === "string" ? variant : JSON.stringify(variant))).join(", ")
    : JSON.stringify(experiment.variants);

  return (
    <tr className="border-b border-border/40 last:border-b-0">
      <td className="py-3 pr-2">
        <div className="flex flex-col">
          <span className="font-medium">{experiment.name}</span>
          <span className="text-xs text-muted">/{experiment.slug}</span>
        </div>
      </td>
      <td className="py-3 pr-2 text-xs text-muted">{variantsText}</td>
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
      <td className="py-3 pr-2">{experiment.assignments}</td>
      <td className="py-3 pr-2">{experiment.events}</td>
      <td className="py-3 pr-2">
        <Button size="sm" onClick={() => onUpdate(experiment.id, status)}>
          Save
        </Button>
      </td>
    </tr>
  );
}
