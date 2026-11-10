"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/form";
import { DEAL_STAGES } from "@/lib/validation";
import { STAGE_LABELS } from "@/lib/display";
import { getErrorMessage } from "@/lib/client-api";

export function CreateDealForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerName: "",
    productName: "",
    description: "",
    stage: "DISCOVERY",
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }

      setForm({
        customerName: "",
        productName: "",
        description: "",
        stage: "DISCOVERY",
      });
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a deal</CardTitle>
        <CardDescription>
          Start a deal workspace, then attach sales call transcripts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="customerName">Customer</Label>
            <Input
              id="customerName"
              value={form.customerName}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  customerName: event.target.value,
                }))
              }
              placeholder="ABC Fitness"
              maxLength={160}
              required
            />
          </div>

          <div>
            <Label htmlFor="productName">Product</Label>
            <Input
              id="productName"
              value={form.productName}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  productName: event.target.value,
                }))
              }
              placeholder="Gym Management Software"
              maxLength={160}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder="Optional context about the opportunity"
              maxLength={4000}
              className="min-h-20"
            />
          </div>

          <div>
            <Label htmlFor="stage">Current stage</Label>
            <Select
              id="stage"
              value={form.stage}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, stage: event.target.value }))
              }
            >
              {DEAL_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </option>
              ))}
            </Select>
          </div>

          {error ? <FieldError>{error}</FieldError> : null}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {loading ? "Creating..." : "Create deal"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
