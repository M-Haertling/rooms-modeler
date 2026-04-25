import { listModels, createModel } from "@/actions/models";
import { redirect } from "next/navigation";
import ModelListItem from "./_components/ModelListItem";

export const dynamic = "force-dynamic";

async function handleCreate(formData: FormData) {
  "use server";
  const name = (formData.get("name") as string)?.trim() || "Untitled Model";
  const id = await createModel(name);
  redirect(`/models/${id}`);
}

export default async function HomePage() {
  const models = await listModels();

  return (
    <main className="min-h-screen p-8" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>
            Rooms
          </h1>
          <form action={handleCreate} className="flex gap-2">
            <input
              name="name"
              placeholder="New model name…"
              className="px-3 py-1.5 rounded text-sm border outline-none focus:ring-1"
              style={{
                background: "var(--surface-2)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
            <button
              type="submit"
              className="px-4 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              New model
            </button>
          </form>
        </div>

        {models.length === 0 ? (
          <div
            className="rounded-lg border p-12 text-center"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            <p className="text-sm">No models yet. Create one to get started.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {models.map((m) => (
              <ModelListItem key={m.id} id={m.id} name={m.name} updatedAt={m.updatedAt} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
