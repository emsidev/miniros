import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateBusinessForm } from "../_components/create-business-form";

export const metadata: Metadata = {
  title: "New business",
  description: "Create a new MINIROS business workspace.",
};

export default function NewBusinessPage() {
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Button asChild variant="ghost" className="-ml-2">
        <Link href="/businesses">
          <ArrowLeft aria-hidden="true" />
          Back to businesses
        </Link>
      </Button>
      <Card className="rounded-3xl py-7 shadow-none">
        <CardHeader className="px-6 sm:px-8">
          <CardTitle className="text-2xl font-extrabold tracking-tight">
            Create a business
          </CardTitle>
          <CardDescription>
            You will become the owner and this workspace will become active.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 sm:px-8">
          <CreateBusinessForm />
        </CardContent>
      </Card>
    </div>
  );
}
