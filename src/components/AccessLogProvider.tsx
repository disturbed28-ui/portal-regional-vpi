import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAccessLog } from "@/hooks/useAccessLog";

export const AccessLogProvider = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { user } = useAuth();
  const { logPageView } = useAccessLog();

  useEffect(() => {
    if (user?.id && location.pathname) {
      // Fire and forget - don't block navigation
      logPageView(user.id, location.pathname);
    }
  }, [location.pathname, user?.id, logPageView]);

  return <>{children}</>;
};
