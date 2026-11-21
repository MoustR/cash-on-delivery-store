import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";

export interface CustomerValues {
  name: string;
  phone: string;
  city: string;
  address: string;
  note: string;
}

export const EMPTY_CUSTOMER: CustomerValues = {
  name: "",
  phone: "",
  city: "",
  address: "",
  note: "",
};

/** Name, phone, city, address and note; test IDs start with `prefix`. */
export function CustomerFields({
  value,
  onChange,
  prefix,
}: {
  value: CustomerValues;
  onChange: (value: CustomerValues) => void;
  prefix: string;
}) {
  const field = (key: keyof CustomerValues, label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`${prefix}-${key}`}>{label}</Label>
      <Input
        id={`${prefix}-${key}`}
        data-testid={`${prefix}-${key}`}
        type={type}
        required
        value={value[key]}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
      />
    </div>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {field("name", "Full name")}
      {field("phone", "Phone", "tel")}
      {field("city", "City")}
      {field("address", "Address")}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${prefix}-note`}>Note (optional)</Label>
        <Textarea
          id={`${prefix}-note`}
          data-testid={`${prefix}-note`}
          value={value.note}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
        />
      </div>
    </div>
  );
}
