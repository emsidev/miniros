import { notFound } from "next/navigation";

import { WorkflowSkeleton } from "./skeleton";

export default function WorkflowSkeletonPage() {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.MINIROS_V2_SKELETON !== "1"
  )
    notFound();

  return <WorkflowSkeleton />;
}
