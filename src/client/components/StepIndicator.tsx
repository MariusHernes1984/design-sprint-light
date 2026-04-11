import { STEP_ORDER, STEP_LABELS, type WorkshopStep } from '../../shared/types.js';

interface StepIndicatorProps {
  currentStep: WorkshopStep;
  steps?: WorkshopStep[];
  onStepClick?: (step: WorkshopStep) => void;
}

export function StepIndicator({ currentStep, steps = STEP_ORDER, onStepClick }: StepIndicatorProps) {
  const currentIdx = steps.indexOf(currentStep);

  return (
    <div className="step-bar">
      {steps.map((step, i) => {
        let className = 'step-item';
        if (i === currentIdx) className += ' active';
        else if (i < currentIdx) className += ' completed';

        return (
          <button
            key={step}
            className={className}
            onClick={() => onStepClick?.(step)}
            disabled={!onStepClick}
            style={!onStepClick ? { cursor: 'default' } : undefined}
          >
            <span className="step-number">
              {i < currentIdx ? '\u2713' : i + 1}
            </span>
            {STEP_LABELS[step]}
          </button>
        );
      })}
    </div>
  );
}
