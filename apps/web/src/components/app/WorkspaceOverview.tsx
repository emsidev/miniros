import type { WorkflowDefinition } from "@miniros/domain";

type WorkspaceOverviewProps = {
  workflows: WorkflowDefinition[];
};

export function WorkspaceOverview({ workflows }: WorkspaceOverviewProps) {
  return (
    <section style={{ marginTop: "2rem" }}>
      <h2 style={{ marginBottom: "1rem" }}>Shared workflow catalog</h2>
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        {workflows.map((workflow) => (
          <article
            key={workflow.id}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: "1rem",
              padding: "1rem",
              background: "#fff",
            }}
          >
            <p style={{ margin: 0, color: "#0ea5e9", fontWeight: 600 }}>
              {workflow.owner}
            </p>
            <h3 style={{ marginBottom: "0.5rem" }}>{workflow.label}</h3>
            <p style={{ margin: 0, color: "#475569" }}>
              {workflow.ruleModules.join(" · ")}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
