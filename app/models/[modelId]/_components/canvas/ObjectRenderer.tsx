"use client";

import { useStore } from "@/store";
import StandardObject from "./StandardObject";
import RoundObject from "./RoundObject";
import ScaleHandles from "./ScaleHandles";

interface Props {
  objectId: string;
}

export default function ObjectRenderer({ objectId }: Props) {
  const obj = useStore((s) => s.objects[objectId]);
  const isSelected = useStore((s) => s.selectedObjectIds.has(objectId));

  if (!obj) return null;

  return (
    <>
      {obj.kind === "round" ? <RoundObject objectId={objectId} /> : <StandardObject objectId={objectId} />}
      {isSelected && !obj.locked && <ScaleHandles objectId={objectId} />}
    </>
  );
}
