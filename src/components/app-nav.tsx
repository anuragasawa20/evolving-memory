import Link from "next/link";
import { BookOpen, Brain, LayoutDashboard, Network, PlugZap } from "lucide-react";

export function AppNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/85 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/deals" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
            <Brain className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">DealOS</span>
          <span className="hidden rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 sm:inline dark:border-neutral-700 dark:text-neutral-400">
            Organizational Learning
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/deals"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <LayoutDashboard className="h-4 w-4" />
            Deals
          </Link>
          <Link
            href="/intelligence"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <Network className="h-4 w-4" />
            Intelligence
          </Link>
          <Link
            href="/learning"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <BookOpen className="h-4 w-4" />
            My Learning
          </Link>
          <Link
            href="/infrastructure"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <PlugZap className="h-4 w-4" />
            Infrastructure
          </Link>
        </nav>
      </div>
    </header>
  );
}
