import Image from "next/image";
import Link from "next/link";

import { AuthControls } from "@/components/auth/auth-controls";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-brand-border/75 bg-brand-paper/95 backdrop-blur-md">
      <nav
        aria-label="Navegación principal"
        className="mx-auto flex h-[4.5rem] w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          aria-label="Ir al inicio de Mama's Garden"
          className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:gap-3"
        >
          <Image
            src="/brand/logo.svg"
            alt=""
            width={46}
            height={46}
            className="size-11 shrink-0"
            priority
          />
          <span className="hidden truncate font-display text-lg font-semibold text-brand-primary min-[420px]:block sm:text-xl">
            Mama&apos;s Garden
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-3">
          <div className="hidden items-center md:flex">
            <Link
              href="/#esencia"
              className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-brand-primary underline-offset-8 hover:text-brand-secondary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              Nuestra esencia
            </Link>
            <Link
              href="/#recorrido"
              className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-brand-primary underline-offset-8 hover:text-brand-secondary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              La finca
            </Link>
            <Link
              href="/#contacto"
              className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-brand-primary underline-offset-8 hover:text-brand-secondary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              Contacto
            </Link>
          </div>
          <AuthControls />
        </div>
      </nav>
    </header>
  );
}
