import { useEffect, useRef } from 'react';

export function useScrollReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold, rootMargin: '0px 0px -50px 0px' }
    );

    // Observe the container and all reveal children
    const children = el.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
    children.forEach((child) => observer.observe(child));
    // Also observe the container itself if it has reveal class
    if (el.classList.contains('reveal') || el.classList.contains('reveal-left') || el.classList.contains('reveal-right') || el.classList.contains('reveal-scale')) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}
