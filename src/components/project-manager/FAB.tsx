// src/components/project-manager/FAB.tsx
import React, { useState } from "react";

interface Props {
  onCreate?: (nameOrPayload: any) => void;
}

const FAB: React.FC<Props> = ({ onCreate }) => {
  const [open, setOpen] = useState<boolean>(false);
  const [name, setName] = useState<string>("");
  const [category, setCategory] = useState<string>("");

  const categories = ["آسانسور", "تله کابین", "پلکان برقی", "سایر"];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (!category) return;
    const payload = { name: name.trim(), category };
    onCreate && onCreate(payload);
    setName("");
    setCategory("");
    setOpen(false);
  }

  return (
    <>
      <div className="fixed left-5 bottom-5 z-40">
        <button
          onClick={() => setOpen((s) => !s)}
          className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white text-2xl font-bold bg-brand-plain dark:bg-brand-plain-dark transform active:scale-95 transition-transform duration-200"
          aria-label="Create project"
        >
          +
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <form onSubmit={submit} className="relative bg-white dark:bg-neutral-900 rounded-2xl p-4 w-full max-w-md shadow-xl z-10 text-right">
            <div className="flex items-center gap-3 justify-between">
              <div className="text-sm font-semibold">Create Project</div>
              <button type="button" onClick={() => setOpen(false)} className="text-neutral-500">Close</button>
            </div>

            <div className="mt-3">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">Project Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Elevator"
                className="mt-2 w-full bg-neutral-50 dark:bg-neutral-800 border border-transparent rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand-plain dark:focus:ring-brand-plain-dark transition"
              />
            </div>

            <div className="mt-3">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-2 w-full bg-neutral-50 dark:bg-neutral-800 border border-transparent rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand-plain dark:focus:ring-brand-plain-dark transition"
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setOpen(false); }} className="px-3 py-1 rounded-md">Cancel</button>
              <button type="submit" className="px-4 py-1 rounded-md bg-brand-plain text-white dark:bg-brand-plain-dark">
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default FAB;
