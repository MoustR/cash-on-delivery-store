import { Alert, AlertDescription } from "@/client/components/ui/alert";

export function FormError({
  message,
  testId = "form-error",
}: {
  message: string | null;
  testId?: string;
}) {
  if (!message) return null;
  return (
    <Alert variant="destructive" data-testid={testId}>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/** The sentence to show for a failed server call. */
export function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) {
    // A validation failure arrives as zod's JSON list of issues.
    try {
      const issues: unknown = JSON.parse(error.message);
      if (Array.isArray(issues) && issues[0]?.message)
        return String(issues[0].message);
    } catch {}
    return error.message;
  }
  return "Something went wrong. Try again.";
}
