import type { ReactNode } from "react";
import { AppNav, type AppNavProps } from "./AppNav";
import { StatusBar, type StatusBarProps } from "./StatusBar";

export type PageFrameProps = {
  active?: AppNavProps["active"];
  children: ReactNode;
  statusLeft?: StatusBarProps["left"];
  statusRight?: StatusBarProps["right"];
};

/**
 * The standard page chrome: a sticky nav on top, the status bar at the bottom and the content
 * between them. `main` is a flex column, so a short page can center itself with `my-auto`.
 */
export function PageFrame({ active, children, statusLeft, statusRight }: PageFrameProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppNav active={active} />
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 pt-8 pb-16 md:px-6 md:pt-10">
        {children}
      </main>
      <StatusBar left={statusLeft} right={statusRight} />
    </div>
  );
}
