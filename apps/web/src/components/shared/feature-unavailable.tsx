import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./feedback";

export function FeatureUnavailable({
  feature,
  destination,
  destinationLabel,
}: {
  feature: string;
  destination: string;
  destinationLabel: string;
}) {
  return (
    <EmptyState
      title={`${feature} is disabled`}
      description={`An admin can enable ${feature} in this business's settings.`}
      action={
        <Button asChild className="mt-2 h-11 rounded-xl">
          <Link href={destination}>{destinationLabel}</Link>
        </Button>
      }
    />
  );
}
