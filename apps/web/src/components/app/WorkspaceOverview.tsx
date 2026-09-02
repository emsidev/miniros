import type { WorkflowDefinition } from "@miniros/domain";

type WorkspaceOverviewProps = {
  workflows: WorkflowDefinition[];
};

export function WorkspaceOverview({ workflows }: WorkspaceOverviewProps) {
  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-bold">Shared workflow catalog</h2>
      <div className="divide-y rounded-xl border bg-card">
        {workflows.map((workflow) => (
          <article
            key={workflow.id}
            className="grid gap-2 p-4 sm:grid-cols-[10rem_1fr] sm:items-start"
          >
            <p className="text-sm font-semibold text-muted-foreground">
              {workflow.owner}
            </p>
            <div>
              <h3 className="font-bold">{workflow.label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {workflow.ruleModules.join(" · ")}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
