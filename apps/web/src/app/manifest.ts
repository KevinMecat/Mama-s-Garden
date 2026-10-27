export const dynamic = "force-static";
import type { MetadataRoute } from "next";


export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finca Mama's Garden",
    short_name: "Mama's Garden",
    description: "Gestion operativa y financiera de la finca.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f8fa",
    theme_color: "#064e3b",
    icons: [
      {
        src: "/brand/app-icon.png",
        sizes: "3000x3000",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
