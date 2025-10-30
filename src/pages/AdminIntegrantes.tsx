import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useIntegrantes } from "@/hooks/useIntegrantes";
import { supabase } from "@/integrations/supabase/client";
import { parseExcelFile, processDelta, parseCargoGrau } from "@/lib/excelParser";
import { Upload, ArrowLeft, Users, UserCheck, UserX, AlertCircle, FileSpreadsheet } from "lucide-react";

const AdminIntegrantes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { integrantes, loading, stats, refetch } = useIntegrantes({ ativo: true });
  const [searchTerm, setSearchTerm] = useState("");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  const integrantesFiltrados = integrantes.filter((i) =>
    i.nome_colete.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setProcessing(true);
      const excelData = await parseExcelFile(file);
      const delta = processDelta(excelData, integrantes);
      
      setUploadPreview({
        file: file.name,
        delta,
        excelData,
      });
      setShowUploadDialog(true);
    } catch (error) {
      toast({
        title: "Erro ao processar arquivo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleApplyChanges = async () => {
    if (!uploadPreview) return;

    try {
      setProcessing(true);
      const { delta, excelData } = uploadPreview;

      // Inserir novos
      if (delta.novos.length > 0) {
        const novosData = delta.novos.map((item: any) => {
          const { cargo, grau } = parseCargoGrau(item.cargo_grau);
          return {
            registro_id: item.id_integrante,
            nome_colete: item.nome_colete,
            comando_texto: item.comando,
            regional_texto: item.regional,
            divisao_texto: item.divisao,
            cargo_grau_texto: item.cargo_grau,
            cargo_nome: cargo,
            grau: grau,
            ativo: true,
            cargo_estagio: item.cargo_estagio || null,
            sgt_armas: item.sgt_armas || false,
            caveira: item.caveira || false,
            caveira_suplente: item.caveira_suplente || false,
            batedor: item.batedor || false,
            ursinho: item.ursinho || false,
            lobo: item.lobo || false,
            tem_moto: item.tem_moto || false,
            tem_carro: item.tem_carro || false,
            data_entrada: item.data_entrada || null,
          };
        });

        const { error: insertError } = await supabase
          .from('integrantes_portal')
          .insert(novosData);

        if (insertError) throw insertError;
      }

      // Atualizar existentes
      if (delta.atualizados.length > 0) {
        for (const { antigo, novo } of delta.atualizados) {
          const { cargo, grau } = parseCargoGrau(novo.cargo_grau);
          
          const { error: updateError } = await supabase
            .from('integrantes_portal')
            .update({
              nome_colete: novo.nome_colete,
              comando_texto: novo.comando,
              regional_texto: novo.regional,
              divisao_texto: novo.divisao,
              cargo_grau_texto: novo.cargo_grau,
              cargo_nome: cargo,
              grau: grau,
              cargo_estagio: novo.cargo_estagio || null,
              sgt_armas: novo.sgt_armas || false,
              caveira: novo.caveira || false,
              caveira_suplente: novo.caveira_suplente || false,
              batedor: novo.batedor || false,
              ursinho: novo.ursinho || false,
              lobo: novo.lobo || false,
              tem_moto: novo.tem_moto || false,
              tem_carro: novo.tem_carro || false,
              data_entrada: novo.data_entrada || null,
            })
            .eq('id', antigo.id);

          if (updateError) throw updateError;
        }
      }

      toast({
        title: "Importacao concluida",
        description: `${delta.novos.length} novos, ${delta.atualizados.length} atualizados`,
      });

      setShowUploadDialog(false);
      setUploadPreview(null);
      refetch();
    } catch (error) {
      toast({
        title: "Erro ao aplicar mudancas",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate('/admin')}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold">Gestao de Integrantes</h1>
            <p className="text-muted-foreground">
              Gerencie o banco de dados de integrantes do portal
            </p>
          </div>
          <Button onClick={() => fileInputRef.current?.click()} disabled={processing}>
            <Upload className="mr-2 h-4 w-4" />
            Importar Excel
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* Estatisticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <UserCheck className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Vinculados</p>
                <p className="text-2xl font-bold">{stats.vinculados}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <UserX className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Nao Vinculados</p>
                <p className="text-2xl font-bold">{stats.naoVinculados}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">Inativos</p>
                <p className="text-2xl font-bold">{stats.inativos}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Busca */}
        <Input
          placeholder="Buscar por nome de colete..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />

        {/* Lista de Integrantes */}
        <Tabs defaultValue="todos">
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="vinculados">Vinculados</TabsTrigger>
            <TabsTrigger value="nao-vinculados">Nao Vinculados</TabsTrigger>
          </TabsList>

          <TabsContent value="todos" className="space-y-4">
            {loading ? (
              <p>Carregando...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {integrantesFiltrados.map((integrante) => (
                  <Card key={integrante.id} className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">{integrante.nome_colete}</p>
                          <p className="text-sm text-muted-foreground">
                            Registro: {integrante.registro_id}
                          </p>
                        </div>
                        {integrante.vinculado ? (
                          <Badge variant="secondary">Vinculado</Badge>
                        ) : (
                          <Badge variant="outline">Disponivel</Badge>
                        )}
                      </div>
                      <div className="text-sm space-y-1">
                        <p><span className="font-semibold">Cargo:</span> {integrante.cargo_grau_texto}</p>
                        {integrante.cargo_estagio && (
                          <p><span className="font-semibold">Estagiando:</span> {integrante.cargo_estagio}</p>
                        )}
                        <p><span className="font-semibold">Divisao:</span> {integrante.divisao_texto}</p>
                        <p><span className="font-semibold">Regional:</span> {integrante.regional_texto}</p>
                        {integrante.data_entrada && (
                          <p><span className="font-semibold">Entrada:</span> {new Date(integrante.data_entrada).toLocaleDateString('pt-BR')}</p>
                        )}
                        <div className="flex gap-1 flex-wrap mt-2">
                          {integrante.tem_moto && <Badge variant="secondary">🏍️ Moto</Badge>}
                          {integrante.tem_carro && <Badge variant="secondary">🚗 Carro</Badge>}
                          {integrante.sgt_armas && <Badge variant="secondary">⚔️ Sgt Armas</Badge>}
                          {integrante.caveira && <Badge variant="secondary">💀 Caveira</Badge>}
                          {integrante.caveira_suplente && <Badge variant="outline">💀 Suplente</Badge>}
                          {integrante.batedor && <Badge variant="secondary">🛡️ Batedor</Badge>}
                          {integrante.ursinho && <Badge variant="secondary">🐻 Ursinho</Badge>}
                          {integrante.lobo && <Badge variant="secondary">🐺 Lobo</Badge>}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="vinculados" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrantesFiltrados
                .filter((i) => i.vinculado)
                .map((integrante) => (
                  <Card key={integrante.id} className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">{integrante.nome_colete}</p>
                          <p className="text-sm text-muted-foreground">
                            Registro: {integrante.registro_id}
                          </p>
                        </div>
                        <Badge variant="secondary">Vinculado</Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <p><span className="font-semibold">Cargo:</span> {integrante.cargo_grau_texto}</p>
                        {integrante.cargo_estagio && (
                          <p><span className="font-semibold">Estagiando:</span> {integrante.cargo_estagio}</p>
                        )}
                        <p><span className="font-semibold">Divisao:</span> {integrante.divisao_texto}</p>
                        {integrante.data_entrada && (
                          <p><span className="font-semibold">Entrada:</span> {new Date(integrante.data_entrada).toLocaleDateString('pt-BR')}</p>
                        )}
                        <div className="flex gap-1 flex-wrap mt-2">
                          {integrante.tem_moto && <Badge variant="secondary">🏍️ Moto</Badge>}
                          {integrante.tem_carro && <Badge variant="secondary">🚗 Carro</Badge>}
                          {integrante.sgt_armas && <Badge variant="secondary">⚔️ Sgt Armas</Badge>}
                          {integrante.caveira && <Badge variant="secondary">💀 Caveira</Badge>}
                          {integrante.caveira_suplente && <Badge variant="outline">💀 Suplente</Badge>}
                          {integrante.batedor && <Badge variant="secondary">🛡️ Batedor</Badge>}
                          {integrante.ursinho && <Badge variant="secondary">🐻 Ursinho</Badge>}
                          {integrante.lobo && <Badge variant="secondary">🐺 Lobo</Badge>}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="nao-vinculados" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrantesFiltrados
                .filter((i) => !i.vinculado)
                .map((integrante) => (
                  <Card key={integrante.id} className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">{integrante.nome_colete}</p>
                          <p className="text-sm text-muted-foreground">
                            Registro: {integrante.registro_id}
                          </p>
                        </div>
                        <Badge variant="outline">Disponivel</Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <p><span className="font-semibold">Cargo:</span> {integrante.cargo_grau_texto}</p>
                        {integrante.cargo_estagio && (
                          <p><span className="font-semibold">Estagiando:</span> {integrante.cargo_estagio}</p>
                        )}
                        <p><span className="font-semibold">Divisao:</span> {integrante.divisao_texto}</p>
                        {integrante.data_entrada && (
                          <p><span className="font-semibold">Entrada:</span> {new Date(integrante.data_entrada).toLocaleDateString('pt-BR')}</p>
                        )}
                        <div className="flex gap-1 flex-wrap mt-2">
                          {integrante.tem_moto && <Badge variant="secondary">🏍️ Moto</Badge>}
                          {integrante.tem_carro && <Badge variant="secondary">🚗 Carro</Badge>}
                          {integrante.sgt_armas && <Badge variant="secondary">⚔️ Sgt Armas</Badge>}
                          {integrante.caveira && <Badge variant="secondary">💀 Caveira</Badge>}
                          {integrante.caveira_suplente && <Badge variant="outline">💀 Suplente</Badge>}
                          {integrante.batedor && <Badge variant="secondary">🛡️ Batedor</Badge>}
                          {integrante.ursinho && <Badge variant="secondary">🐻 Ursinho</Badge>}
                          {integrante.lobo && <Badge variant="secondary">🐺 Lobo</Badge>}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de Preview de Upload */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview das Mudancas</DialogTitle>
            <DialogDescription>
              Revise as mudancas antes de aplicar
            </DialogDescription>
          </DialogHeader>

          {uploadPreview && (
            <div className="space-y-4">
              <Card className="p-4 bg-accent">
                <div className="flex items-center space-x-3">
                  <FileSpreadsheet className="h-6 w-6" />
                  <div>
                    <p className="font-semibold">{uploadPreview.file}</p>
                    <p className="text-sm text-muted-foreground">
                      {uploadPreview.excelData.length} registros no arquivo
                    </p>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Novos</p>
                  <p className="text-3xl font-bold text-green-600">
                    {uploadPreview.delta.novos.length}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Atualizados</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {uploadPreview.delta.atualizados.length}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Sem Mudanca</p>
                  <p className="text-3xl font-bold text-gray-600">
                    {uploadPreview.delta.semMudanca}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Removidos</p>
                  <p className="text-3xl font-bold text-red-600">
                    {uploadPreview.delta.removidos.length}
                  </p>
                </Card>
              </div>

              {uploadPreview.delta.novos.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Novos Integrantes (primeiros 5):</h4>
                  <div className="space-y-2">
                    {uploadPreview.delta.novos.slice(0, 5).map((item: any, idx: number) => (
                      <Card key={idx} className="p-2 text-sm">
                        <p className="font-semibold">{item.nome_colete}</p>
                        <p className="text-muted-foreground">
                          {item.cargo_grau} - {item.divisao}
                        </p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleApplyChanges} disabled={processing}>
              {processing ? "Processando..." : "Aplicar Mudancas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminIntegrantes;
