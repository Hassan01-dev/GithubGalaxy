import { redirect } from "next/navigation";
import { DEFAULT_GALAXY } from "@/lib/galaxy/galaxies";

export default function Explore() {
  redirect(`/galaxy/${DEFAULT_GALAXY}`);
}
