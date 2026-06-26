interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizeMap = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizeMap[size]} border-2 border-accent border-t-transparent rounded-full animate-spin`} />
    </div>
  );
}
