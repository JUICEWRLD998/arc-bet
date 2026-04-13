"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ModeToggle } from "@/components/ModeToggle";

export function Navbar() {

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-xl tracking-tight text-zinc-900 dark:text-zinc-50 hover:opacity-80 transition-opacity"
        >
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white text-sm font-bold">
            A
          </span>
          ArcBet
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          <NavLink href="/">Markets</NavLink>
          <NavLink href="/create">Create</NavLink>
          <NavLink href="/my-bets">My Bets</NavLink>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <ModeToggle />
          <ConnectButton
            accountStatus="avatar"
            chainStatus="icon"
            showBalance={false}
          />
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden flex items-center gap-1 px-4 pb-3">
        <NavLink href="/">Markets</NavLink>
        <NavLink href="/create">Create</NavLink>
        <NavLink href="/my-bets">My Bets</NavLink>
      </nav>
    </header>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
    >
      {children}
    </Link>
  );
}
