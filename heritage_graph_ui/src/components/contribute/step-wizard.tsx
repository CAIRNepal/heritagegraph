"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StepIndicator } from "./step-indicator";

interface Step {
  id: string;
  label: string;
  description?: string;
}

interface StepWizardProps {
  steps: Step[];
  children: React.ReactNode[];
  onComplete: () => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  /** Validate the current step before allowing next. Return true to proceed. */
  validateStep?: (stepIndex: number) => boolean;
  className?: string;
  title?: string;
  description?: string;
}

export function StepWizard({
  steps,
  children,
  onComplete,
  onCancel,
  isSubmitting = false,
  validateStep,
  className,
  title,
  description,
}: StepWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const goNext = () => {
    if (validateStep && !validateStep(currentStep)) return;
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const goBack = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const goToStep = (index: number) => {
    if (index <= currentStep) {
      setCurrentStep(index);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      {(title || description) && (
        <div>
          {title && <h1 className="text-2xl font-bold">{title}</h1>}
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      )}

      {/* Step indicator */}
      <StepIndicator
        steps={steps}
        currentStep={currentStep}
        onStepClick={goToStep}
      />

      {/* Current step content */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">
              {steps[currentStep].label}
            </h2>
            {steps[currentStep].description && (
              <p className="text-sm text-muted-foreground mt-1">
                {steps[currentStep].description}
              </p>
            )}
          </div>

          {/* Render the current step's content */}
          <div className="min-h-[200px]">{children[currentStep]}</div>
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <div>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={isFirstStep || isSubmitting}
          >
            Back
          </Button>
          <Button
            onClick={goNext}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Submitting..."
              : isLastStep
              ? "Submit Contribution"
              : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
