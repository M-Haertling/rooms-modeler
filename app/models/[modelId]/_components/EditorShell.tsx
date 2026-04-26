"use client";

import { useEffect } from "react";
import { useStore } from "@/store";
import type { CanvasObject, CanvasPoint, CanvasSegment, CanvasLayer, LayerConfiguration, ObjectType, Project, Template } from "@/types/canvas";
import Editor from "./Editor";

interface Props {
  modelId: string;
  project: Project;
  objects: CanvasObject[];
  points: CanvasPoint[];
  segments: CanvasSegment[];
  layers: CanvasLayer[];
  configurations: LayerConfiguration[];
  objectTypes: ObjectType[];
  templates: Template[];
}

export default function EditorShell(props: Props) {
  const hydrate = useStore((s) => s.hydrate);
  const setTemplates = useStore((s) => s.setTemplates);

  useEffect(() => {
    hydrate({
      modelId: props.modelId,
      projectId: props.project.id,
      projectName: props.project.name,
      unit: props.project.unit,
      objects: props.objects,
      points: props.points,
      segments: props.segments,
      layers: props.layers,
      configurations: props.configurations,
      objectTypes: props.objectTypes,
    });
    setTemplates(props.templates);
  }, [props.modelId]); // eslint-disable-line react-hooks/exhaustive-deps

  return <Editor />;
}
