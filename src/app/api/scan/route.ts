export async function POST() {
  return Response.json(
    {
      error:
        "Photo matching now runs on your device against the demo catalog. Open Identify to scan a part.",
    },
    { status: 410 },
  );
}
