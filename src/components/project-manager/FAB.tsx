import React, { useState } from "react";

interface Props {
  onCreate?: (name: string) => void;
}

const FAB: React.FC<Props> = ({ onCreate }) => {
  const [open, setOpen] = useState<boolean>(false);
  const [name, setName] = useState<string>("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onCreate && onCreate(name);
    setName("");
    setOpen(false);
  }

  return (
    <>
      <div className="fixed left-5 bottom-5 z-40">
        {/* در RTL بهتر است FAB در سمت چپ قرار بگیرد (سنت معمول در بسیاری اپ‌ها) */}
        <button
          onClick={() => setOpen((s) => !s)}
          className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white text-2xl font-bold bg-brand-plain dark:bg-brand-plain-dark transform active:scale-95 transition-transform duration-200"
          aria-label="ایجاد پروژه"
        >
          +
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <form onSubmit={submit} className="relative bg-white dark:bg-neutral-900 rounded-2xl p-4 w-full max-w-md shadow-xl z-10 text-right">
            <div className="flex items-center gap-3 justify-between">
              <div className="text-sm font-semibold">ایجاد پروژه</div>
              <button type="button" onClick={() => setOpen(false)} className="text-neutral-500">بستن</button>
            </div>

            <div className="mt-3">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">نام پروژه</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً: داشبورد موبایل"
                className="mt-2 w-full bg-neutral-50 dark:bg-neutral-800 border border-transparent rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand-plain dark:focus:ring-brand-plain-dark transition"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-1 rounded-md">انصراف</button>
              <button type="submit" className="px-4 py-1 rounded-md bg-brand-plain text-white dark:bg-brand-plain-dark">ساخت</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default FAB;
