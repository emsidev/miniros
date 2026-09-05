"use client";

import { useLayoutEffect, useRef, type ComponentProps } from "react";

/** The shell can grow when navigation expands or labels wrap. */
export function WorkspaceHeader(props: ComponentProps<"header">) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () =>
      document.documentElement.style.setProperty(
        "--workspace-header-height",
        `${element.getBoundingClientRect().height}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty(
        "--workspace-header-height",
      );
    };
  }, []);
  return <header {...props} ref={ref} />;
}
