import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, ArrowLeft, FileText, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { LogsSystemSection } from "@/components/admin/LogsSystemSection";
import { LogsEmailSection } from "@/components/admin/LogsEmailSection";

const AdminLogs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: loadingAccess } = useAdminAccess();
  const [activeTab, setActiveTab] = useState("sistema");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!loadingAccess && !hasAccess) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [loadingAccess, hasAccess, navigate, toast]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (loadingAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) return null;

  return (
    <div className="min-h-screen bg-background p-3 md:p-4">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="flex-shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Auditoria</h1>
            <p className="text-sm text-muted-foreground">Logs de sistema e envios de email</p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-10">
            <TabsTrigger value="sistema" className="text-xs md:text-sm">
              <FileText className="h-3 w-3 md:h-4 md:w-4 mr-1.5" />
              Sistema
            </TabsTrigger>
            <TabsTrigger value="emails" className="text-xs md:text-sm">
              <Mail className="h-3 w-3 md:h-4 md:w-4 mr-1.5" />
              Emails
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="sistema" className="mt-4">
            <LogsSystemSection key={`sistema-${refreshKey}`} />
          </TabsContent>
          
          <TabsContent value="emails" className="mt-4">
            <LogsEmailSection key={`emails-${refreshKey}`} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminLogs;
