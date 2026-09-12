import { notFound } from "next/navigation";
import { StaffPreview } from "./preview";
export default function StaffPreviewPage() {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.MINIROS_V2_SKELETON !== "1"
  )
    notFound();
  return <StaffPreview />;
}
