import { PageHeader } from "@/components/shared/layout";
export default function LoadingDevices() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Devices"
        description="Shift devices across all your locations."
      />
      <p role="status" className="text-sm text-muted-foreground">
        Loading shift devices…
      </p>
    </div>
  );
}
