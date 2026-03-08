"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

type ProfileFormProps = {
  initial?: {
    name?: string | null;
    phone?: string | null;
    birthday?: string | null;
    preferences?: Record<string, unknown> | null;
    sizes?: Record<string, unknown> | null;
  };
};

type PreferencesPayload = {
  favoriteCategories?: string;
  styleNotes?: string;
  preferredColors?: string;
};

type SizesPayload = {
  shoeSize?: string;
  apparelSize?: string;
  bagFit?: string;
};

const getString = (value: unknown) => (typeof value === "string" ? value : "");

export function AccountProfileForm({ initial }: ProfileFormProps) {
  const toast = useToast();
  const preferences = initial?.preferences ?? {};
  const sizes = initial?.sizes ?? {};

  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [birthday, setBirthday] = useState(initial?.birthday ?? "");
  const [favoriteCategories, setFavoriteCategories] = useState(getString(preferences.favoriteCategories));
  const [styleNotes, setStyleNotes] = useState(getString(preferences.styleNotes));
  const [preferredColors, setPreferredColors] = useState(getString(preferences.preferredColors));
  const [shoeSize, setShoeSize] = useState(getString(sizes.shoeSize));
  const [apparelSize, setApparelSize] = useState(getString(sizes.apparelSize));
  const [bagFit, setBagFit] = useState(getString(sizes.bagFit));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        birthday: birthday || undefined,
        preferences: {
          favoriteCategories: favoriteCategories.trim() || undefined,
          styleNotes: styleNotes.trim() || undefined,
          preferredColors: preferredColors.trim() || undefined,
        } satisfies PreferencesPayload,
        sizes: {
          shoeSize: shoeSize.trim() || undefined,
          apparelSize: apparelSize.trim() || undefined,
          bagFit: bagFit.trim() || undefined,
        } satisfies SizesPayload,
      };

      const res = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to update profile");
      }
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <Input label="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        <Input
          label="Birthday"
          type="date"
          value={birthday ?? ""}
          onChange={(event) => setBirthday(event.target.value)}
        />
        <Input
          label="Favorite categories"
          value={favoriteCategories}
          onChange={(event) => setFavoriteCategories(event.target.value)}
          placeholder="Tweed, Silk, Upholstery"
        />
      </div>
      <Input
        label="Style notes"
        value={styleNotes}
        onChange={(event) => setStyleNotes(event.target.value)}
        placeholder="Quiet luxury, neutral palette, travel-ready"
      />
      <Input
        label="Preferred colors"
        value={preferredColors}
        onChange={(event) => setPreferredColors(event.target.value)}
        placeholder="Camel, black, ivory"
      />
      <div className="grid gap-3 md:grid-cols-3">
        <Input label="Shoe size" value={shoeSize} onChange={(event) => setShoeSize(event.target.value)} />
        <Input label="Apparel size" value={apparelSize} onChange={(event) => setApparelSize(event.target.value)} />
        <Input label="Bag fit" value={bagFit} onChange={(event) => setBagFit(event.target.value)} />
      </div>
      <Button onClick={handleSave} loading={saving} className="rounded-full">
        Save profile
      </Button>
    </div>
  );
}
