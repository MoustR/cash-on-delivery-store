import { Badge } from "@/client/components/ui/badge";
import type { OrderStatus } from "@/lib/statuses";
import { STATUS_LABELS } from "@/lib/pipeline";

const VARIANT = {
  pending: "warning",
  confirmed: "info",
  shipped: "soft",
  delivered: "secondary",
  paid: "success",
  cancelled: "outline",
  returned: "destructive",
} as const;

export function StatusBadge({
  status,
  testId,
}: {
  status: OrderStatus;
  testId?: string;
}) {
  return (
    <Badge variant={VARIANT[status]} data-testid={testId}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
