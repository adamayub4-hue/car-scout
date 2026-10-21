"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { useSearchParams } from "next/navigation";

// The surrounding Suspense boundary contains only this invisible observer, so
// the search form itself remains available in the prerendered HTML.
export default function SearchQueryObserver({ onChange }: { onChange: (query: string) => void }) {
  const query = useSearchParams().toString();
  const previous = useRef(query);
  const notify = useEffectEvent(onChange);
  useEffect(() => {
    if (previous.current === query) return;
    previous.current = query;
    notify(query);
  }, [query]);
  return null;
}
