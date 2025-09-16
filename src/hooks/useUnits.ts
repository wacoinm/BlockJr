// src/hooks/useUnits.ts
import { useCallback, useState } from 'react';

type UnitOption = { key: string; label: string; value: number };

export default function useUnits() {
  const unitOptions: UnitOption[] = [
    { key: '100m', label: '100m', value: 0.1 },
    { key: '10m', label: '10m', value: 0.01 },
    { key: '1s', label: '1s', value: 1 },
  ];

  const [unitIndex, setUnitIndex] = useState<number>(0);

  const cycleUnit = useCallback(() => {
    setUnitIndex((i) => (i + 1) % unitOptions.length);
  }, []);

  const unitValue = unitOptions[unitIndex].value;
  const unitLabel = unitOptions[unitIndex].label;

  return { unitIndex, unitValue, unitLabel, cycleUnit } as const;
}
