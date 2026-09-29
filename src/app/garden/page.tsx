import { redirect } from "next/navigation";

// "My garden" is now part of "My plants" (the places tab).
export default function GardenPage() {
  redirect("/plants?tab=places");
}
