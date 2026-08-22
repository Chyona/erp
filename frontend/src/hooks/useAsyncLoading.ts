import { useCallback, useState } from 'react';

/** 包裹异步任务，自动维护 loading 状态 */
export function useAsyncLoading(initial = false) {
  const [loading, setLoading] = useState(initial);

  const run = useCallback(async <T,>(task: () => Promise<T>): Promise<T> => {
    setLoading(true);
    try {
      return await task();
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, setLoading, run };
}
