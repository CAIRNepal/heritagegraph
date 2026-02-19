"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep,
  onStepClick,
  className,
}: StepIndicatorProps) {
  return (
    <nav
      aria-label="Progress"
      className={cn("w-full", className)}
    >
      <ol className="flex items-center w-full">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = onStepClick && index <= currentStep;

          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center",
                index < steps.length - 1 ? "flex-1" : ""
              )}
            >
              <button
                type="button"
                className={cn(
                  "flex items-center gap-2 group",
                  isClickable ? "cursor-pointer" : "cursor-default"
                )}
                onClick={() => isClickable && onStepClick?.(index)}
                disabled={!isClickable}
              >
                {/* Step circle */}
                <span
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium shrink-0 transition-colors",
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : isCurrent
                      ? "border-2 border-primary text-primary bg-background"
                      : "border-2 border-muted-foreground/30 text-muted-foreground bg-background"
                  )}
                >
                  {isCompleted ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>

                {/* Step label */}
                <span
                  className={cn(
                    "text-sm font-medium hidden sm:block",
                    isCurrent
                      ? "text-foreground"
                      : isCompleted
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </button>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-3 transition-colors",
                    isCompleted ? "bg-primary" : "bg-muted-foreground/20"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
