import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Nodara — Tu espacio de trabajo todo en uno",
  description: "Documentos, wikis, proyectos y bases de datos en un solo lugar. Open source y sin cuenta para empezar.",
};

export default function WelcomePage() {
  return <LandingPage />;
}
