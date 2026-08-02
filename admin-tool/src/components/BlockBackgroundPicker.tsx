'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setBlockBackground } from '@/app/sites/[siteId]/settings-actions';

const OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'surface', label: 'Tinted band' },
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Dark' },
];

export default function BlockBackgroundPicker({
  siteId,
  blockId,
  current,
}: {
  siteId: string;
  blockId: string;
  current: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(value: string) {
    setError(null);
    startTransition(async () => {
      const result = await setBlockBackground(siteId, blockId, value);
      if (!result.ok) {
        setError(result.error ?? 'Could not change the background.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <label className="bgpicker" title="Section background, taken from the site theme">
      <span className="bgpicker__label">Background</span>
      <select
        className="bgpicker__select"
        value={current}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="blockctl__error">{error}</span>}
    </label>
  );
}
