import { notFound } from "next/navigation";
import { getProject } from "@/actions/models";
import { loadProjectData } from "@/actions/objects";
import { listTemplates } from "@/actions/templates";
import EditorShell from "./_components/EditorShell";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ modelId: string }>;
}

export default async function ModelPage({ params }: Props) {
  const { modelId } = await params;
  const project = await getProject(modelId);
  if (!project) notFound();

  const { objects, points, segments, layers, objectTypes } = await loadProjectData(modelId);
  const templates = await listTemplates(modelId);

  return (
    <EditorShell
      modelId={modelId}
      project={project}
      objects={objects}
      points={points}
      segments={segments}
      layers={layers}
      objectTypes={objectTypes}
      templates={templates}
    />
  );
}
