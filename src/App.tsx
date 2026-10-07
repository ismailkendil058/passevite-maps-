import { Suspense, lazy } from 'react';
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
const Website = lazy(() => import("./pages/Website"));
const Accueil = lazy(() => import("./pages/Accueil"));
const Client = lazy(() => import("./pages/Client"));
const Manager = lazy(() => import("./pages/Manager"));
const Rendezvous = lazy(() => import("./pages/Rendezvous"));
const Satisfaction = lazy(() => import("./pages/Satisfaction"));
const Feedback = lazy(() => import("./pages/Feedback"));
const Merci = lazy(() => import("./pages/Merci"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Depenses = lazy(() => import("./pages/Depenses"));
const Factures = lazy(() => import("./pages/Factures"));
const AjouterFacture = lazy(() => import("./pages/AjouterFacture"));
const Appointment = lazy(() => import("./pages/Appointment"));
const LoginAppointment = lazy(() => import("./pages/LoginAppointment"));
const TV = lazy(() => import("./pages/TV"));
const LoginMedecin = lazy(() => import("./pages/LoginMedecin"));
const MedecinDashboard = lazy(() => import("./pages/MedecinDashboard"));
const UserManager = lazy(() => import("./pages/UserManager"));
const LaboPage = lazy(() => import("./pages/LaboPage"));
const PatientCard = lazy(() => import("./pages/PatientCard"));
const Ordonnance = lazy(() => import("./pages/Ordonnance"));
const Inventaire = lazy(() => import("./pages/Inventaire"));
const LoginInventaire = lazy(() => import("./pages/LoginInventaire"));


window.scrollTo(0, 0);


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
    if (path.startsWith('/appointment')) return <Navigate to="/appointment/login" replace />;
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
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/website" element={<Website />} />
            <Route path="/accueil/login" element={<LoginAccueil />} />
            <Route path="/manager/login" element={<LoginManager />} />
            <Route path="/appointment/login" element={<LoginAppointment />} />
            <Route path="/inventaire/login" element={<LoginInventaire />} />

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
            <Route path="/manager/depenses" element={
              <ProtectedRoute requiredRoles={['manager', 'admin']}><Depenses /></ProtectedRoute>
            } />
            <Route path="/manager/users" element={
              <ProtectedRoute requiredRoles={['manager', 'admin']}><UserManager /></ProtectedRoute>
            } />
            <Route path="/manager/factures" element={
              <ProtectedRoute requiredRoles={['manager', 'receptionist', 'admin']}><Factures /></ProtectedRoute>
            } />
            <Route path="/manager/factures/ajouter" element={
              <ProtectedRoute requiredRoles={['manager', 'receptionist', 'admin']}><AjouterFacture /></ProtectedRoute>
            } />
            <Route path="/accueil/factures/ajouter" element={
              <ProtectedRoute requiredRoles={['manager', 'receptionist', 'admin']}><AjouterFacture /></ProtectedRoute>
            } />
            <Route path="/labo" element={
              <ProtectedRoute requiredRoles={['manager', 'receptionist', 'admin']}><LaboPage /></ProtectedRoute>
            } />



            <Route path="/rendezvous" element={
              <ProtectedRoute requiredRoles={['manager', 'receptionist', 'admin']}><Rendezvous /></ProtectedRoute>
            } />
            <Route path="/appointment" element={
              <ProtectedRoute requiredRoles={['manager', 'admin']}><Appointment /></ProtectedRoute>
            } />
            <Route path="/tv" element={<TV />} />
            <Route path="/doctor/login" element={<LoginMedecin />} />
            <Route path="/doctor" element={
              <MedecinDashboard />
            } />
            <Route path="/patient" element={<PatientCard />} />
            <Route path="/inventaire" element={
              <ProtectedRoute requiredRoles={['manager', 'receptionist', 'admin']}><Inventaire /></ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />

          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
