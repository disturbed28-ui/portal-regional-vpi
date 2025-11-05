import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useScreenAccess } from "@/hooks/useScreenAccess";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  screenRoute: string;
}

export const ProtectedRoute = ({ children, screenRoute }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: accessLoading } = useScreenAccess(screenRoute, user?.id);
  const { toast } = useToast();

  const loading = authLoading || accessLoading;

  useEffect(() => {
    if (!loading && !hasAccess) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
    }
  }, [loading, hasAccess, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
