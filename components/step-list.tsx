interface StepListProps {
  steps: string[];
}

export function StepList({ steps }: StepListProps) {
  return (
    <ol className="space-y-4">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-4 items-start">
          <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm font-bold shadow-md shadow-purple-500/20">
            {index + 1}
          </span>
          <div className="flex-1 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <p className="text-white/80 text-[15px] leading-relaxed">{step}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
