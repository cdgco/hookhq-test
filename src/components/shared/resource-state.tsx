"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CircleX, LoaderCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function LoadingStateCard({ title = "Loading..." }: { title?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-8">
        <LoaderCircle className="mb-4 h-12 w-12 animate-spin text-muted-foreground" />
        <h3 className="text-lg font-semibold">{title}</h3>
      </CardContent>
    </Card>
  );
}

export function ErrorStateCard({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-8">
        <CircleX className="mb-4 h-12 w-12 text-red-400" />
        <h3 className="mb-2 text-lg font-semibold">Error</h3>
        <p className="text-center text-red-600">{message}</p>
      </CardContent>
    </Card>
  );
}

export function EmptyStateCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-8">
        <Icon className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
        <p className="text-center text-muted-foreground">{description}</p>
        {children}
      </CardContent>
    </Card>
  );
}
