import { useEffect, useState } from 'react';
import { getAll, onChange } from '@/lib/store';

export type StoreData = Awaited<ReturnType<typeof getAll>>;

/** Live view of everything in storage; re-reads whenever any page or tab writes. */
export function useStore(): StoreData | null {
  const [data, setData] = useState<StoreData | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => getAll().then((d) => alive && setData(d));
    void load();
    const stop = onChange(load);
    return () => {
      alive = false;
      stop();
    };
  }, []);
  return data;
}
