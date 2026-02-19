"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TypeOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface TypePickerProps {
  options: TypeOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function TypePicker({
  options,
  value,
  onChange,
  label,
  columns = 3,
  className,
}: TypePickerProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  };

  return (
    <div className={cn("space-y-3", className)}>
      {label && (
        <h3 className="text-sm font-medium text-foreground">{label}</h3>
      )}
      <div className={cn("grid gap-3", gridCols[columns])}>
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <Card
              key={option.value}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                isSelected
                  ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                  : "hover:border-primary/50"
              )}
              onClick={() => onChange(option.value)}
            >
              <CardHeader className="p-4 pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  {option.icon && (
                    <span className="text-lg">{option.icon}</span>
                  )}
                  {option.label}
                </CardTitle>
              </CardHeader>
              {option.description && (
                <CardContent className="p-4 pt-1">
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
