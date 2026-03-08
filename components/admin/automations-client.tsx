"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

type AutomationRule = {
  id: string;
  name: string;
  trigger: string;
  channel: string;
  active: boolean;
  delayMinutes: number;
  filters?: Record<string, unknown> | null;
  template?: Record<string, unknown> | null;
};

type VipTier = {
  id: string;
  name: string;
};

const triggers = [
  "WELCOME",
  "BROWSE_ABANDONED",
  "CART_ABANDONED",
  "PAYMENT_ABANDONED",
  "POST_PURCHASE",
  "BACK_IN_STOCK",
  "PRICE_DROP",
  "VIP_DROP",
  "NEW_ARRIVAL",
];

const parseList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export function AutomationsClient() {
  const toast = useToast();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [vipTiers, setVipTiers] = useState<VipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("WELCOME");
  const [channel, setChannel] = useState("EMAIL");
  const [delayMinutes, setDelayMinutes] = useState("0");
  const [segmentInput, setSegmentInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [minLifetimeValue, setMinLifetimeValue] = useState("");
  const [minOrderCount, setMinOrderCount] = useState("");
  const [selectedVipTierIds, setSelectedVipTierIds] = useState<string[]>([]);
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateHeadline, setTemplateHeadline] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [templateCtaLabel, setTemplateCtaLabel] = useState("");
  const [templateCtaUrl, setTemplateCtaUrl] = useState("");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const isEditing = Boolean(editingRuleId);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/automations");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to load automations");
      }
      setRules(json.data?.rules ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load automations");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadVipTiers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/vip-tiers");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to load VIP tiers");
      }
      setVipTiers(json.data?.tiers ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadRules();
    loadVipTiers();
  }, [loadRules, loadVipTiers]);

  const resetForm = () => {
    setEditingRuleId(null);
    setName("");
    setTrigger("WELCOME");
    setChannel("EMAIL");
    setDelayMinutes("0");
    setSegmentInput("");
    setTagInput("");
    setMinLifetimeValue("");
    setMinOrderCount("");
    setSelectedVipTierIds([]);
    setTemplateSubject("");
    setTemplateHeadline("");
    setTemplateBody("");
    setTemplateCtaLabel("");
    setTemplateCtaUrl("");
  };

  const filtersPayload = useMemo(() => {
    const segments = parseList(segmentInput);
    const tags = parseList(tagInput);
    const filters: Record<string, unknown> = {};
    if (segments.length) filters.segment = segments;
    if (tags.length) filters.tags = tags;
    if (selectedVipTierIds.length) filters.vipTierIds = selectedVipTierIds;
    if (minLifetimeValue) filters.minLifetimeValue = Number(minLifetimeValue);
    if (minOrderCount) filters.minOrderCount = Number(minOrderCount);
    return Object.keys(filters).length ? filters : undefined;
  }, [segmentInput, tagInput, selectedVipTierIds, minLifetimeValue, minOrderCount]);

  const templatePayload = useMemo(() => {
    const template: Record<string, string> = {};
    if (templateSubject.trim()) template.subject = templateSubject.trim();
    if (templateHeadline.trim()) template.headline = templateHeadline.trim();
    if (templateBody.trim()) template.body = templateBody.trim();
    if (templateCtaLabel.trim()) template.ctaLabel = templateCtaLabel.trim();
    if (templateCtaUrl.trim()) template.ctaUrl = templateCtaUrl.trim();
    return Object.keys(template).length ? template : undefined;
  }, [templateSubject, templateHeadline, templateBody, templateCtaLabel, templateCtaUrl]);

  const submitRule = async () => {
    if (!name.trim()) {
      toast.error("Enter a name");
      return;
    }
    const payload = {
      name: name.trim(),
      trigger,
      channel,
      delayMinutes: Number(delayMinutes || 0),
      filters: filtersPayload,
      template: templatePayload,
    };
    try {
      const res = await fetch(
        isEditing ? `/api/admin/automations/${editingRuleId}` : "/api/admin/automations",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to save automation");
      }
      toast.success(isEditing ? "Automation updated" : "Automation created");
      resetForm();
      loadRules();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save automation");
    }
  };

  const toggleRule = async (id: string, active: boolean) => {
    try {
      const res = await fetch(`/api/admin/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to update automation");
      }
      setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, active } : rule)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update automation");
    }
  };

  const startEdit = (rule: AutomationRule) => {
    setEditingRuleId(rule.id);
    setName(rule.name);
    setTrigger(rule.trigger);
    setChannel(rule.channel);
    setDelayMinutes(String(rule.delayMinutes ?? 0));
    const filters = (rule.filters ?? {}) as Record<string, unknown>;
    setSegmentInput(Array.isArray(filters.segment) ? filters.segment.join(", ") : "");
    setTagInput(Array.isArray(filters.tags) ? filters.tags.join(", ") : "");
    setSelectedVipTierIds(Array.isArray(filters.vipTierIds) ? filters.vipTierIds : []);
    setMinLifetimeValue(
      typeof filters.minLifetimeValue === "number" ? String(filters.minLifetimeValue) : "",
    );
    setMinOrderCount(
      typeof filters.minOrderCount === "number" ? String(filters.minOrderCount) : "",
    );
    const template = (rule.template ?? {}) as Record<string, string>;
    setTemplateSubject(template.subject ?? "");
    setTemplateHeadline(template.headline ?? "");
    setTemplateBody(template.body ?? "");
    setTemplateCtaLabel(template.ctaLabel ?? "");
    setTemplateCtaUrl(template.ctaUrl ?? "");
  };

  const runDispatch = async () => {
    try {
      const res = await fetch("/api/admin/automations/run", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Dispatch failed");
      }
      toast.success("Queued notifications dispatched");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dispatch failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Automation builder</p>
            <h2 className="font-display text-xl">
              {isEditing ? "Edit automation" : "Create automation"}
            </h2>
          </div>
          {isEditing && (
            <Button variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} />
          <label className="flex flex-col gap-2 text-sm text-ink">
            <span className="font-medium text-ink">Trigger</span>
            <select
              className="rounded-md border border-border bg-surface px-4 py-3 text-sm"
              value={trigger}
              onChange={(event) => setTrigger(event.target.value)}
            >
              {triggers.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-ink">
            <span className="font-medium text-ink">Channel</span>
            <select
              className="rounded-md border border-border bg-surface px-4 py-3 text-sm"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
            >
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input
            label="Delay (minutes)"
            value={delayMinutes}
            onChange={(event) => setDelayMinutes(event.target.value)}
          />
          <Input
            label="Segments (comma separated)"
            value={segmentInput}
            onChange={(event) => setSegmentInput(event.target.value)}
            placeholder="VIP, Repeat"
          />
          <Input
            label="Tags (comma separated)"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            placeholder="editorial, high_intent"
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input
            label="Min LTV"
            value={minLifetimeValue}
            onChange={(event) => setMinLifetimeValue(event.target.value)}
            placeholder="1000"
          />
          <Input
            label="Min orders"
            value={minOrderCount}
            onChange={(event) => setMinOrderCount(event.target.value)}
            placeholder="2"
          />
          <div className="space-y-2 text-sm text-ink">
            <p className="font-medium text-ink">VIP tiers</p>
            <div className="flex flex-wrap gap-2">
              {vipTiers.length === 0 ? (
                <span className="text-xs text-muted">No tiers configured</span>
              ) : (
                vipTiers.map((tier) => {
                  const checked = selectedVipTierIds.includes(tier.id);
                  return (
                    <label key={tier.id} className="flex items-center gap-2 text-xs text-muted">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedVipTierIds((prev) => [...prev, tier.id]);
                          } else {
                            setSelectedVipTierIds((prev) => prev.filter((id) => id !== tier.id));
                          }
                        }}
                      />
                      {tier.name}
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input
            label="Email subject"
            value={templateSubject}
            onChange={(event) => setTemplateSubject(event.target.value)}
            placeholder="Welcome to NEWUOOTD"
          />
          <Input
            label="Headline"
            value={templateHeadline}
            onChange={(event) => setTemplateHeadline(event.target.value)}
            placeholder="Your private edit is ready"
          />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Input
            label="CTA label"
            value={templateCtaLabel}
            onChange={(event) => setTemplateCtaLabel(event.target.value)}
            placeholder="View the edit"
          />
          <Input
            label="CTA URL"
            value={templateCtaUrl}
            onChange={(event) => setTemplateCtaUrl(event.target.value)}
            placeholder="https://..."
          />
        </div>
        <label className="mt-3 flex flex-col gap-2 text-sm text-ink">
          <span className="font-medium">Body</span>
          <textarea
            className="min-h-[120px] rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
            value={templateBody}
            onChange={(event) => setTemplateBody(event.target.value)}
            placeholder="Message body"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={submitRule}>{isEditing ? "Update automation" : "Create automation"}</Button>
          <Button variant="ghost" onClick={runDispatch}>
            Dispatch pending
          </Button>
          <Button variant="ghost" onClick={loadRules}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading automations...</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No automation rules yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="py-2 pr-2">Name</th>
                <th className="py-2 pr-2">Trigger</th>
                <th className="py-2 pr-2">Channel</th>
                <th className="py-2 pr-2">Delay</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-border/40 last:border-b-0">
                  <td className="py-3 pr-2 font-medium">{rule.name}</td>
                  <td className="py-3 pr-2">{rule.trigger}</td>
                  <td className="py-3 pr-2">{rule.channel}</td>
                  <td className="py-3 pr-2">{rule.delayMinutes}m</td>
                  <td className="py-3 pr-2">
                    <Button
                      size="sm"
                      variant={rule.active ? "primary" : "ghost"}
                      onClick={() => toggleRule(rule.id, !rule.active)}
                    >
                      {rule.active ? "Active" : "Paused"}
                    </Button>
                  </td>
                  <td className="py-3 pr-2">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(rule)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
