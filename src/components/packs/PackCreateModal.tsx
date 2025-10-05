// src/components/packs/PackCreateModal.tsx
import React, { useState } from "react";

type Pack = {
  id: string;
  name: string;
  description?: string;
  items: string[];
  qrRaw: string;
};

const DEFAULT_ITEMS = [
  "telecabin",
  "elevator",
  "crane",
  "lift truck",
  "buildozer",
  "escalator",
];

const PackCreateModal: React.FC<{ open: boolean; onClose: () => void; onCreate: (p: Pack) => void }> = ({ open, onClose, onCreate }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [qrRaw, setQrRaw] = useState(() => {
    // generate a random 16-char ascii string for default qrRaw
    const arr = new Uint8Array(16);
    if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(arr);
    } else {
      for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(arr).map((b) => String.fromCharCode((b % 26) + 65)).join("");
  });

  function toggleItem(i: string) {
    setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  }

  function submit() {
    if (!name || selected.length === 0) return;
    const id = name.toLowerCase().replace(/\s+/g, "-");
    onCreate({ id, name, description, items: selected, qrRaw });
    // reset
    setName("");
    setDescription("");
    setSelected([]);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl p-4 w-full max-w-lg shadow-xl z-10 text-right">
        <h3 className="text-lg font-semibold mb-2">ساخت پَک جدید</h3>
        <div className="mb-3">
          <label className="text-xs text-neutral-500">نام پَک</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 rounded-lg mt-1 bg-neutral-50 dark:bg-neutral-800" />
        </div>
        <div className="mb-3">
          <label className="text-xs text-neutral-500">توضیح (اختیاری)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-2 rounded-lg mt-1 bg-neutral-50 dark:bg-neutral-800" />
        </div>

        <div className="mb-3">
          <label className="text-xs text-neutral-500">آیتم‌ها</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {DEFAULT_ITEMS.map((it) => (
              <button
                key={it}
                onClick={() => toggleItem(it)}
                className={`px-3 py-1 rounded-full border ${selected.includes(it) ? "bg-indigo-100 border-indigo-300" : "bg-neutral-50"}`}
              >
                {it}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className="text-xs text-neutral-500">QR raw (16 chars)</label>
          <input value={qrRaw} onChange={(e) => setQrRaw(e.target.value.slice(0, 16))} maxLength={16} className="w-full p-2 rounded-lg mt-1 bg-neutral-50 dark:bg-neutral-800" />
          <div className="text-xs text-neutral-400 mt-1">طول باید ۱۶ کاراکتر باشد (ما از آن base64 می‌سازیم).</div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-md border">انصراف</button>
          <button onClick={submit} className="px-4 py-2 rounded-md bg-brand-plain text-white">ساخت</button>
        </div>
      </div>
    </div>
  );
};

export default PackCreateModal;
