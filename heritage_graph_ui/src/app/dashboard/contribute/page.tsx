"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getNavigableClasses,
  getClassesByCategory,
  categoryMeta,
} from "@/lib/ontology";

export default function ContributeDashboard() {
  const router = useRouter();
  const grouped = getClassesByCategory();

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold">Contribute Knowledge</h1>
        <p className="text-muted-foreground mt-2">
          Choose a domain to contribute cultural, historical, or heritage information.
        </p>
      </div>

      {Object.entries(grouped).map(([catKey, classes]) => {
        const meta = categoryMeta[catKey] || { label: catKey, icon: "box" };
        return (
          <div key={catKey}>
            <h2 className="text-xl font-semibold mb-4">{meta.label}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.map((cls) => (
                <Card
                  key={cls.key}
                  className="hover:shadow-lg transition-shadow"
                >
                  <CardHeader>
                    <CardTitle>{cls.label}</CardTitle>
                    <CardDescription>
                      {cls.description?.substring(0, 100)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-end">
                    <Button
                      onClick={() =>
                        router.push(`/dashboard/contribute/${cls.key}`)
                      }
                    >
                      Contribute
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
