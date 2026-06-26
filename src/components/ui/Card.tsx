interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

export default function Card({ children, className = '', padding = 'md' }: CardProps) {
  const paddingMap = { sm: 'p-4', md: 'p-5', lg: 'p-6' };
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${paddingMap[padding]} ${className}`}>
      {children}
    </div>
  );
}
