import Image from "next/image";
import Link from "next/link";

const locationUrl =
  "https://www.google.com/maps/search/?api=1&query=Le%C3%B3n%2C%20Nicaragua";

export function PublicFooter() {
  return (
    <footer id="contacto" className="scroll-mt-24 bg-[#123b30] px-5 py-12 text-white sm:px-8 lg:py-16">
      <div className="mx-auto grid max-w-7xl gap-10 border-b border-white/12 pb-10 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div className="max-w-md">
          <Link
            href="/"
            aria-label="Ir al inicio de Mama's Garden"
            className="inline-flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span className="grid size-12 place-items-center rounded-xl bg-brand-paper">
              <Image src="/brand/logo.svg" alt="" width={42} height={42} className="size-10" />
            </span>
            <span className="font-sans text-xl font-semibold">Mama&apos;s Garden</span>
          </Link>
          <p className="mt-5 text-sm leading-7 text-white/66">
            Naturaleza, calidad y futuro unidos en una finca que produce con responsabilidad y gestiona cada recurso con claridad.
          </p>
        </div>

        <nav aria-label="Enlaces de la finca">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-sage">Conócenos</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li><Link href="/#esencia" className="text-white/74 hover:text-white">Nuestra esencia</Link></li>
            <li><Link href="/#recorrido" className="text-white/74 hover:text-white">Áreas de trabajo</Link></li>
            <li><a href={locationUrl} target="_blank" rel="noreferrer" className="text-white/74 hover:text-white">Ubicación en León</a></li>
          </ul>
        </nav>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-sage">Equipo de la finca</p>
          <p className="mt-4 text-sm leading-6 text-white/66">
            El acceso operativo está reservado para personal autorizado.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-white/25 px-5 text-sm font-semibold text-white transition hover:bg-white hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Acceso para trabajadores
          </Link>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-2 pt-7 text-xs text-white/48 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Finca Mama&apos;s Garden. Todos los derechos reservados.</p>
        <a href={locationUrl} target="_blank" rel="noreferrer" className="hover:text-white">
          León, Nicaragua
        </a>
      </div>
    </footer>
  );
}
