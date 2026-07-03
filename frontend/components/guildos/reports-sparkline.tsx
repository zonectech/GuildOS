type SparklineProps = {
  values: number[];
  className?: string;
};

export function ReportsSparkline({ values, className = '' }: SparklineProps) {
  const max = Math.max(...values, 1);

  return (
    <div className={`flex h-28 items-end gap-2 ${className}`.trim()}>
      {values.map((value, index) => {
        const height = `${Math.max((value / max) * 100, 8)}%`;
        return (
          <div key={index} className="flex-1 rounded-t-xl bg-indigo-500/15">
            <div
              className="w-full rounded-t-xl bg-gradient-to-t from-indigo-600 to-violet-500"
              style={{ height }}
            />
          </div>
        );
      })}
    </div>
  );
}
