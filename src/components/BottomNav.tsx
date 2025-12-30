import { Home, Upload, ListChecks } from 'lucide-react';

interface BottomNavProps {
  currentScreen: 'input' | 'categorization' | 'dashboard';
  onNavigate: (screen: 'input' | 'categorization' | 'dashboard') => void;
}

export function BottomNav({ currentScreen, onNavigate }: BottomNavProps) {
  const navItems = [
    { id: 'dashboard' as const, icon: Home, label: 'Dashboard' },
    { id: 'input' as const, icon: Upload, label: 'Import' },
    { id: 'categorization' as const, icon: ListChecks, label: 'Review' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom">
      <div className="flex justify-around items-center h-16 max-w-2xl mx-auto">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors ${
              currentScreen === id
                ? 'text-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={24} />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
