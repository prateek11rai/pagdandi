import { NewPlan } from "@/components/new-plan";
import { pickFeatured } from "@/lib/featured";
import { listTreks } from "@/lib/treks";

export const dynamic = "force-dynamic";

// The home page is the trek guide. Treks to browse are on /treks.
export default async function NewPlanPage() {
  const treks = await listTreks();
  return <NewPlan featured={pickFeatured(treks)} total={treks.length} />;
}
