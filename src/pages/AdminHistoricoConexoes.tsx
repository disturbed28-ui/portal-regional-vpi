import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Search, Filter, X, RefreshCw, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useProfilesWithAccess, ProfileWithAccess } from "@/hooks/useProfilesWithAccess";
import { useRegionais } from "@/hooks/useRegionais";
import { useDivisoesPorRegional } from "@/hooks/useDivisoesPorRegional";
import { UserAccessDetail } from "@/components/admin/UserAccessDetail";

const AdminHistoricoConexoes = () => {
  const navigate = useNavigate();
  const { hasAccess, loading: accessLoading } = useAdminAccess();
  const { profiles, loading, filters, updateFilters, clearFilters, refresh } = useProfilesWithAccess();
  const { regionais } = useRegionais();
  const { divisoes } = useDivisoesPorRegional(filters.regionalId || undefined);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ProfileWithAccess | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  if (accessLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatLastAccess = (dateStr: string | null) => {
    if (!dateStr) return "Nunca acessou";
    try {
      return format(new Date(dateStr), "dd/MM/yy 'às' HH:mm", { locale: ptBR });
    } catch {
      return "Data inválida";
    }
  };

  const hasActiveFilters = filters.search || filters.regionalId || filters.divisaoId || filters.status;

  const handleUserClick = (user: ProfileWithAccess) => {
    setSelectedUser(user);
    setDetailOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-2 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Histórico de Conexões</h1>
            <p className="text-xs text-muted-foreground">Visão administrativa de acessos ao portal</p>
          </div>
          <Button variant="ghost" size="icon" onClick={refresh}>
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Filters */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <div className="px-4 pb-2 flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
                className="pl-9"
              />
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Filter className="h-4 w-4" />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={filters.regionalId || "all"}
                onValueChange={(v) => updateFilters({ regionalId: v === "all" ? null : v, divisaoId: null })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Regional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas regionais</SelectItem>
                  {regionais?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.divisaoId || "all"}
                onValueChange={(v) => updateFilters({ divisaoId: v === "all" ? null : v })}
                disabled={!filters.regionalId}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Divisão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas divisões</SelectItem>
                  {divisoes?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Select
              value={filters.status || "all"}
              onValueChange={(v) => updateFilters({ status: v === "all" ? null : v })}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="Aprovado">Aprovado</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="w-full" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Limpar filtros
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))
        ) : profiles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum usuário encontrado</p>
            </CardContent>
          </Card>
        ) : (
          profiles.map((profile) => (
            <Card
              key={profile.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => handleUserClick(profile)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {profile.photo_url ? (
                      <img
                        src={profile.photo_url}
                        alt={profile.nome_colete || profile.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-sm truncate">
                        {profile.nome_colete || profile.name}
                      </h3>
                      <Badge
                        variant={profile.profile_status === "Aprovado" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {profile.profile_status}
                      </Badge>
                    </div>
                    {(profile.regional || profile.divisao) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[profile.regional, profile.divisao].filter(Boolean).join(' • ')}
                      </p>
                    )}
                    {(profile.cargo || profile.grau) && (
                      <p className="text-xs text-muted-foreground">
                        {[profile.cargo, profile.grau].filter(Boolean).join(' ')}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className={profile.last_access_at ? "" : "italic"}>
                        {formatLastAccess(profile.last_access_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Detail Modal */}
      <UserAccessDetail
        user={selectedUser}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedUser(null);
        }}
      />
    </div>
  );
};

export default AdminHistoricoConexoes;
