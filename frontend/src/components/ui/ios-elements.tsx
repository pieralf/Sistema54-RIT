import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility per unire classi tailwind
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 1. IOS CARD (Il contenitore bianco stondato)
export const IOSCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4", className)}>
    {children}
  </div>
);

// 2. IOS INPUT (Input di testo pulito)
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}
export const IOSInput = React.forwardRef<HTMLInputElement, InputProps>(({ label, className, ...props }, ref) => (
  <div className="mb-4">
    {label && (
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
        {label}
      </label>
    )}
    <input
      ref={ref}
      className={cn(
        "w-full bg-gray-50 border border-gray-200 text-gray-900 text-base rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3 transition-shadow outline-none",
        className
      )}
      {...props}
    />
  </div>
));

// 3. IOS TOGGLE (Al posto delle Checkbox)
interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}
export const IOSToggle = ({ label, checked, onChange }: ToggleProps) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
    <span className="text-gray-900 font-medium">{label}</span>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        checked ? "bg-blue-600" : "bg-gray-200"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white transition shadow-sm",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  </div>
);

// 3b. IOS SWITCH (toggle compatto senza label)
interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const IOSSwitch = ({ checked, onChange, disabled }: SwitchProps) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={cn(
      "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
      disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      checked ? "bg-blue-600" : "bg-gray-200"
    )}
  >
    <span
      className={cn(
        "inline-block h-5 w-5 transform rounded-full bg-white transition shadow-sm",
        checked ? "translate-x-6" : "translate-x-1"
      )}
    />
  </button>
);

// 4. IOS TEXTAREA (Per le descrizioni lunghe)
export const IOSTextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }>(
  ({ label, className, ...props }, ref) => (
    <div className="mb-4">
      {label && (
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={cn(
          "w-full bg-gray-50 border border-gray-200 text-gray-900 text-base rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3 transition-shadow outline-none resize-none",
          className
        )}
        {...props}
      />
    </div>
  )
);

// 5. IOS SELECT (Select dropdown elegante)
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Array<{ value: string; label: string }>;
}
export const IOSSelect = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, className, ...props }, ref) => (
    <div className="mb-4">
      {label && (
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={cn(
          "w-full bg-gray-50 border border-gray-200 text-gray-900 text-base rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3 transition-shadow outline-none",
          className
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
);

// 6. IOS PROGRESS BAR (Barra di progresso elegante)
interface IOSProgressBarProps {
  progress: number; // 0-100
  label?: string;
  status?: string; // Messaggio di stato (es: "Backup database...")
  className?: string;
  showPercentage?: boolean;
}

export const IOSProgressBar = ({ 
  progress, 
  label, 
  status, 
  className,
  showPercentage = true 
}: IOSProgressBarProps) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">{label}</span>
          {showPercentage && (
            <span className="text-sm font-bold text-blue-600">{Math.round(clampedProgress)}%</span>
          )}
        </div>
      )}
      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out shadow-sm"
          style={{ width: `${clampedProgress}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>
      {status && (
        <p className="mt-2 text-xs text-gray-500 animate-pulse">{status}</p>
      )}
    </div>
  );
};
