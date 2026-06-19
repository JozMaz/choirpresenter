import { useEffect, useState } from "react";

/**
 * Vrací hodnotu opožděnou o `delay` ms — typické použití na search input:
 * UI je vázané na okamžitý `value`, ale search loop běží proti
 * vrácené debounced hodnotě, tak nereaguje na každý keystroke.
 */
export function useDebounced<T>(value: T, delay = 150): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
