import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { initializeDefaultData } from './services/database';
import { BottomNav } from './components/BottomNav';
import { InputScreen } from './screens/InputScreen';
import { CategorizationScreen } from './screens/CategorizationScreen';
import { DashboardScreen } from './screens/DashboardScreen';

function App() {
  const { currentScreen, setCurrentScreen, loadData, isLoading } = useStore();

  useEffect(() => {
    const init = async () => {
      await initializeDefaultData();
      await loadData();
    };
    init();
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="pb-16">
        {currentScreen === 'input' && <InputScreen />}
        {currentScreen === 'categorization' && <CategorizationScreen />}
        {currentScreen === 'dashboard' && <DashboardScreen />}
      </main>

      {/* Bottom Navigation */}
      <BottomNav currentScreen={currentScreen} onNavigate={setCurrentScreen} />
    </div>
  );
}

export default App;
