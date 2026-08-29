import { MapPin, Navigation } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLocationType, formatMoney } from "@/lib/format";
import { listLocations } from "@/server/services/locations";
import { CreateLocationDialog } from "../_components/create-location-dialog";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const locations = await listLocations();
  const createAction = <CreateLocationDialog />;

  return (
    <>
      <PageHeader
        title="Selling locations"
        description="Track each venue with its usual rent and transport costs."
        action={locations.length > 0 ? createAction : undefined}
      />

      {locations.length === 0 ? (
        <EmptyState
          title="No selling locations yet"
          description="Add the first booth, bazaar, kiosk, or event before scheduling a shift."
          action={createAction}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {locations.map((location) => (
            <Card key={location.id} className="rounded-2xl py-5 shadow-none">
              <CardHeader className="flex-row items-start gap-3 px-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted">
                  <MapPin className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate font-bold">
                    {location.name}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatLocationType(location.locationType)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={location.status} />
                  <CreateLocationDialog location={location} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-5">
                {location.address ? (
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Navigation
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{location.address}</span>
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    Rent {formatMoney(location.defaultRentalCostCents)}
                  </Badge>
                  <Badge variant="outline">
                    Transport {formatMoney(location.defaultTransportCostCents)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
