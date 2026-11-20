/** useSection — Section shown by the app, kept in the URL hash (`#maison`), and the widgets a link asks to unfold. */
import { useEffect, useState } from 'react';

import { parseSectionHash, type SectionId } from '../constants/sections';

/** Section named by the hash; `focus` lists the widgets a link asked to unfold (`#maison/lights`). */
export interface SectionRequest {
  section: SectionId;
  /** A new array for each navigation, so the same link followed twice is seen twice. */
  focus: readonly string[];
  /** Part of the first focused widget to open (`#maison/temperature/<sensor>`). */
  detail?: string;
}

/**
 * Section named by the URL hash. Navigation is a plain link to `#<section>`: the browser's
 * back button, a reload and a shared link all land on the same section. A link to
 * `#<section>/<widget>` also names the widgets to unfold: the dashboard unfolds them and
 * scrolls to them, so the hook leaves the scroll to it. A third part names a detail of the first
 * widget to open (`#maison/temperature/<sensor>`).
 *
 * @returns The current section (the home overview for an empty or unknown hash), the widgets to
 * unfold and the detail to open.
 */
export function useSection(): SectionRequest {
  const [request, setRequest] = useState<SectionRequest>(() =>
    parseSectionHash(window.location.hash),
  );

  useEffect(() => {
    const onHashChange = () => {
      const next = parseSectionHash(window.location.hash);
      setRequest(next);
      // A section starts at its top, like a page.
      if (next.focus.length === 0) window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return request;
}
