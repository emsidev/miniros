import { workflowCatalog } from "@miniros/domain";
import { heroCopy } from "@miniros/ui";
import { AuthNotice } from "../components/auth/AuthNotice";
import { WorkspaceOverview } from "../components/app/WorkspaceOverview";

export default function HomePage() {
  return (
    <main style={{ padding: "3rem 1.5rem", maxWidth: 960, margin: "0 auto" }}>
      <p style={{ color: "#0ea5e9", fontWeight: 700 }}>{heroCopy.eyebrow}</p>
      <h1
        style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", marginBottom: "1rem" }}
      >
        {heroCopy.headline}
      </h1>
      <p style={{ fontSize: "1.125rem", lineHeight: 1.6, maxWidth: 720 }}>
        {heroCopy.description}
      </p>
      <WorkspaceOverview workflows={workflowCatalog} />
      <AuthNotice />
    </main>
  );
}
