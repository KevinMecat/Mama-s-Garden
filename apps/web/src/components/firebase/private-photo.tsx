"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { readStorageUrl } from "@/lib/firebase-client";
export function PrivatePhoto({
  source,
  name,
  large = false,
}: {
  source: unknown;
  name: string;
  large?: boolean;
}) {
  const [photo, setPhoto] = useState<{source: unknown; url?: string; error?: boolean}>();
  const url = photo && photo.source === source ? photo.url : undefined;
  const error = photo && photo.source === source && photo.error;
  useEffect(() => {
    let active = true;
    if (source)
      void readStorageUrl(source)
        .then((value) => {
          if (active) setPhoto({source, url: value});
        })
        .catch(() => {
          if (active) setPhoto({source, error: true});
        });
    return () => {
      active = false;
    };
  }, [source]);
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-emerald-50 text-emerald-700 ${large ? "size-20" : "size-10"}`}
    >
      {url && !error ? (
        <Image
          src={url}
          alt={name}
          fill
          sizes={large ? "80px" : "40px"}
          unoptimized
          className="object-cover"
          onError={() => setPhoto({source, error: true})}
        />
      ) : (
        <Users
          size={large ? 26 : 18}
          aria-label={error ? "Foto no disponible" : "Sin foto"}
        />
      )}
    </span>
  );
}
