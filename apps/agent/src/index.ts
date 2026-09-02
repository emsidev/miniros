import { workflowCatalog } from "@miniros/domain";

console.log(
  JSON.stringify(
    {
      workspace: "@miniros/agent",
      workflows: workflowCatalog.map((workflow) => workflow.id),
    },
    null,
    2,
  ),
);
