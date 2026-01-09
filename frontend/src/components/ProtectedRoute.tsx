import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
  requiredPermission?: string; // Es: 'can_view_magazzino', 'can_edit_magazzino'
}

export default function ProtectedRoute({ children, requiredRole, requiredPermission }: ProtectedRouteProps) {
  const { isAuthenticated, user, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Controlla il ruolo se specificato
  if (requiredRole && user) {
    // SuperAdmin ha sempre accesso a tutto
    if (user.ruolo === 'superadmin') {
      return <>{children}</>;
    }
    // Controlla se il ruolo dell'utente è nella lista dei ruoli richiesti
    if (!requiredRole.includes(user.ruolo)) {
      // Se non è nella lista, controlla i permessi se specificati
      if (requiredPermission) {
        const hasPermission = user.permessi?.[requiredPermission] === true;
        if (!hasPermission) {
          return <Navigate to="/" replace />;
        }
      } else {
        return <Navigate to="/" replace />;
      }
    }
  }

  // Controlla i permessi se specificati (senza requiredRole)
  if (requiredPermission && user) {
    // SuperAdmin ha sempre tutti i permessi
    if (user.ruolo === 'superadmin') {
      return <>{children}</>;
    }
    // Altrimenti controlla il permesso specifico (anche per Admin)
    const hasPermission = user.permessi?.[requiredPermission] === true;
    if (!hasPermission) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}

