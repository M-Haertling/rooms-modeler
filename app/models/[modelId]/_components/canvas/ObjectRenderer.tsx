"use client";

import { useStore } from "@/store";
import StandardObject from "./StandardObject";
import RoundObject from "./RoundObject";

interface Props {
  objectId: string;
}

export default function ObjectRenderer({ objectId }: Props) {
  const obj = useStore((s) => s.objects[objectId]);
  if (!obj) return null;
  if (obj.kind === "round") return <RoundObject objectId={objectId} />;
  return <StandardObject objectId={objectId} />;
}
