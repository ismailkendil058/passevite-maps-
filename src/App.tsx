import { Component, Suspense, lazy, ReactNode, ErrorInfo } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import DynamicManifest from "./components/DynamicManifest";

// Lazy load pages for better performance
const Index = lazy(() => import("./pages/Index"));
const LoginAccueil = lazy(() => import("./pages/LoginAccueil"));
const LoginManager = lazy(() => import("./pages/LoginManager"));
const Accueil = lazy(() => import("./pages/Accueil"));
const Client = lazy(() => import("./pages/Client"));
const Manager = lazy(() => import("./pages/Manager"));
const Rendezvous = lazy(() => import("./pages/Rendezvous"));
const Satisfaction = lazy(() => import("./pages/Satisfaction"));
const Feedback = lazy(() => import("./pages/Feedback"));
const Merci = lazy(() => import("./pages/Merci"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TV = lazy(() => import("./pages/TV"));
const LoginMedecin = lazy(() => import("./pages/LoginMedecin"));
const MedecinDashboard = lazy(() => import("./pages/MedecinDashboard"));
const UserManager = lazy(() => import("./pages/UserManager"));
const Ordonnance = lazy(() => import("./pages/Ordonnance"));


window.scrollTo(0, 0);

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in component:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Une erreur est survenue</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Une mise à jour ou un problème de chargement a eu lieu.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all active:scale-95 text-sm"
          >
            Recharger la page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children, requiredRoles }: { children: React.ReactNode; requiredRoles?: string[] }) {
  const { user, loading, userRole } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) {
    const path = window.location.pathname;
    if (path.startsWith('/accueil')) return <Navigate to="/accueil/login" replace />;
    if (path.startsWith('/manager')) return <Navigate to="/manager/login" replace />;

    // Fallback based on required roles if path didn't match
    if (requiredRoles?.includes('receptionist')) return <Navigate to="/accueil/login" replace />;
    if (requiredRoles?.includes('manager')) return <Navigate to="/manager/login" replace />;
    return <Navigate to="/" replace />;
  }

  if (requiredRoles && userRole === null) return <LoadingScreen />;

  if (requiredRoles && !requiredRoles.includes(userRole || '')) {
    if (userRole === 'manager') return <Navigate to="/manager" replace />;
    if (userRole === 'receptionist') return <Navigate to="/accueil" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <DynamicManifest />
      <AuthProvider>
        <ErrorBoundary>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/accueil/login" element={<LoginAccueil />} />
              <Route path="/manager/login" element={<LoginManager />} />

              <Route path="/client" element={<Client />} />
              <Route path="/review" element={<Satisfaction />} />
              <Route path="/feedback" element={<Feedback />} />
              <Route path="/merci" element={<Merci />} />
              <Route path="/accueil" element={
                <ProtectedRoute requiredRoles={['receptionist', 'manager', 'admin']}><Accueil /></ProtectedRoute>
              } />
              <Route path="/manager" element={
                <ProtectedRoute requiredRoles={['manager', 'admin']}><Manager /></ProtectedRoute>
              } />
              <Route path="/manager/users" element={
                <ProtectedRoute requiredRoles={['manager', 'admin']}><UserManager /></ProtectedRoute>
              } />



              <Route path="/rendezvous" element={
                <ProtectedRoute requiredRoles={['manager', 'receptionist', 'admin']}><Rendezvous /></ProtectedRoute>
              } />
              <Route path="/tv" element={<TV />} />
              <Route path="/doctor/login" element={<LoginMedecin />} />
              <Route path="/doctor" element={
                <MedecinDashboard />
              } />
              <Route path="*" element={<NotFound />} />

            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
