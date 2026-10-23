import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicFooter } from "@/components/layout/public-footer";
import { PublicShell } from "@/components/layout/public-shell";

export const metadata: Metadata = {
  title: { absolute: "Finca Mama's Garden | Cultivamos con propósito" },
  description:
    "Conoce Finca Mama's Garden en León, Nicaragua: agricultura sostenible, producción avícola responsable y una gestión clara de cada proyecto.",
  keywords: [
    "agricultura",
    "León Nicaragua",
    "finca sostenible",
    "producción avícola",
    "cultivo de cítricos",
    "Mama's Garden",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Finca Mama's Garden | Cultivamos con propósito",
    description:
      "Naturaleza, calidad y futuro desde León, Nicaragua. Conoce una finca que produce con responsabilidad y crece con información clara.",
    url: "/",
    siteName: "Finca Mama's Garden",
    locale: "es_NI",
    type: "website",
    images: [
      {
        url: "/brand/open-graph.png",
        width: 1731,
        height: 909,
        alt: "Finca Mama's Garden, cultivamos con propósito",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Finca Mama's Garden | Cultivamos con propósito",
    description: "Agricultura y producción responsable desde León, Nicaragua.",
    images: ["/brand/open-graph.png"],
  },
};

const workAreas = [
  {
    title: "Cultivo responsable",
    description:
      "Cuidamos cada ciclo con atención al suelo, al agua y a la calidad de lo que producimos.",
    image: "/images/landing/cultivation.jpg",
    alt: "Parcelas agrícolas verdes organizadas en líneas de cultivo",
  },
  {
    title: "Bienestar animal",
    description:
      "Acompañamos la producción avícola con rutinas claras, seguimiento constante y cuidado diario.",
    image: "/images/landing/poultry.jpg",
    alt: "Gallinas de granja caminando libremente sobre el pasto",
  },
  {
    title: "Gestión consciente",
    description:
      "Ordenamos la información operativa y financiera para decidir con evidencia y proteger los recursos.",
    image: "/images/landing/operations.jpg",
    alt: "Trabajador recorriendo un campo cultivado durante la jornada",
  },
];

export default function HomePage() {
  return (
    <PublicShell>
      <section className="relative isolate flex min-h-[calc(100svh-4.5rem)] items-end overflow-hidden">
        <Image
          src="/images/landing/hero-farm.jpg"
          alt="Paisaje de cultivos verdes iluminados por el amanecer"
          fill
          priority
          quality={88}
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1d2112]/95 via-[#293019]/58 to-[#293019]/12" />

        <div className="relative mx-auto w-full max-w-7xl px-5 py-14 text-white sm:px-8 sm:py-20 lg:px-10 lg:py-24">
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/82">
              Naturaleza · Calidad · Futuro
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[0.96] font-semibold tracking-[-0.035em] text-balance sm:text-6xl lg:text-[5.25rem]">
              Cultivamos hoy la finca que queremos dejar mañana.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/82 sm:text-xl">
              En Mama&apos;s Garden unimos el cuidado de la tierra, la producción responsable y una gestión ordenada para crecer con raíces firmes.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#esencia"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-7 text-base font-bold text-brand-primary transition hover:bg-brand-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Conoce nuestra esencia
              </a>
              <a
                href="#contacto"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/45 bg-black/10 px-7 text-base font-bold text-white backdrop-blur-sm transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Contacto y ubicación
              </a>
            </div>
          </div>

          <div className="mt-12 grid max-w-3xl gap-px overflow-hidden rounded-2xl border border-white/18 bg-white/18 sm:grid-cols-3">
            {[
              ["01", "Producción responsable"],
              ["02", "Proyectos trazables"],
              ["03", "Decisiones informadas"],
            ].map(([number, label]) => (
              <div key={number} className="flex items-center gap-3 bg-brand-primary/62 px-5 py-4 backdrop-blur-sm">
                <span className="font-display text-xl text-brand-sage">{number}</span>
                <p className="text-sm font-semibold text-white/90">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="esencia" className="scroll-mt-24 bg-brand-paper px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-18">
          <div className="relative min-h-[28rem] overflow-hidden rounded-[2rem] sm:min-h-[36rem]">
            <Image
              src="/images/landing/operations.jpg"
              alt="Persona observando el desarrollo de un cultivo en la finca"
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover"
            />
            <div className="absolute inset-x-5 bottom-5 rounded-2xl bg-brand-paper/92 p-5 shadow-xl backdrop-blur sm:inset-x-8 sm:bottom-8 sm:p-6">
              <p className="font-display text-2xl font-semibold text-brand-primary">Crecer sin perder el origen.</p>
              <p className="mt-2 text-sm leading-6 text-brand-muted">Ese es el compromiso que guía cada decisión.</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-secondary">Nuestra esencia</p>
            <h2 className="mt-4 max-w-2xl font-display text-4xl leading-[1.06] font-semibold tracking-tight text-brand-primary sm:text-5xl lg:text-6xl">
              Cuidar lo que producimos empieza por cuidar cómo lo hacemos.
            </h2>
            <p className="mt-6 text-lg leading-8 text-brand-muted">
              Nuestra visión es construir una finca productiva, sostenible y transparente. Cada cultivo, lote y mejora forma parte de un proyecto con propósito, responsables claros y recursos bien administrados.
            </p>
            <p className="mt-4 text-base leading-7 text-brand-muted">
              La experiencia del campo sigue siendo el corazón de Mama&apos;s Garden. La tecnología nos ayuda a documentarla, medirla y convertirla en decisiones que fortalecen al equipo y al futuro de la finca.
            </p>

            <dl className="mt-9 grid gap-5 border-t border-brand-border pt-7 sm:grid-cols-3">
              {[
                ["Trazabilidad", "Cada recurso tiene destino."],
                ["Cuidado", "La calidad nace del detalle."],
                ["Claridad", "Decidimos con información."],
              ].map(([term, description]) => (
                <div key={term}>
                  <dt className="font-display text-xl font-semibold text-brand-primary">{term}</dt>
                  <dd className="mt-1 text-sm leading-6 text-brand-muted">{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section id="recorrido" className="scroll-mt-24 bg-[#eeeadc] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-secondary">La finca en acción</p>
              <h2 className="mt-4 font-display text-4xl leading-tight font-semibold tracking-tight text-brand-primary sm:text-5xl">
                Una operación conectada de principio a fin.
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-brand-muted lg:justify-self-end">
              Producir bien significa entender la relación entre el trabajo diario, el uso de los recursos y el resultado de cada proyecto.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {workAreas.map((area, index) => (
              <article key={area.title} className="group overflow-hidden rounded-[1.75rem] border border-brand-border bg-brand-surface shadow-[0_18px_50px_rgba(72,73,39,0.07)]">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={area.image}
                    alt={area.alt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover transition duration-500 motion-safe:group-hover:scale-[1.025]"
                  />
                  <span className="absolute top-4 left-4 grid size-10 place-items-center rounded-full bg-brand-paper text-sm font-bold text-brand-primary shadow-sm">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="p-6 sm:p-7">
                  <h3 className="font-display text-2xl font-semibold text-brand-primary">{area.title}</h3>
                  <p className="mt-3 leading-7 text-brand-muted">{area.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand-primary px-5 py-18 text-white sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-sage">Una finca bien administrada</p>
            <h2 className="mt-4 font-display text-4xl leading-tight font-semibold sm:text-5xl">
              La información también es una herramienta de campo.
            </h2>
            <p className="mt-5 text-lg leading-8 text-white/72">
              Nuestro sistema conecta proyectos, finanzas, producción y equipo para que cada jornada aporte a una visión común.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand-sage px-7 text-base font-bold text-brand-primary transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-fit"
          >
            Ingresar al sistema
          </Link>
        </div>
      </section>

      <PublicFooter />
    </PublicShell>
  );
}
