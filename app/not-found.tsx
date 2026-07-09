import type { Metadata } from "next";
import { NotFoundView } from "@/components/NotFoundView";

export const metadata: Metadata = {
  title: "Página no encontrada | EvalHub",
};

export default function NotFound() {
  return <NotFoundView />;
}
