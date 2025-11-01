import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const PoliticaPrivacidade = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="bg-card border rounded-lg p-8 shadow-sm">
          <h1 className="text-3xl font-bold mb-6">Política de Privacidade</h1>
          
          <div className="space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Introdução</h2>
              <p>
                Esta Política de Privacidade descreve como coletamos, usamos e protegemos as informações
                pessoais dos usuários do Portal Regional Vale do Paraíba I - SP.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Informações Coletadas</h2>
              <p>
                Coletamos informações fornecidas diretamente por você durante o cadastro e uso da plataforma,
                incluindo nome, e-mail, telefone e outras informações de perfil necessárias para o funcionamento
                do sistema.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Uso das Informações</h2>
              <p>
                As informações coletadas são utilizadas exclusivamente para:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Gerenciar seu acesso e perfil na plataforma</li>
                <li>Facilitar a comunicação entre membros</li>
                <li>Organizar eventos e atividades</li>
                <li>Gerar relatórios administrativos internos</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Compartilhamento de Dados</h2>
              <p>
                Seus dados não são compartilhados com terceiros, exceto quando necessário para o funcionamento
                da plataforma ou quando exigido por lei.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Segurança</h2>
              <p>
                Implementamos medidas de segurança técnicas e organizacionais para proteger suas informações
                contra acesso não autorizado, alteração, divulgação ou destruição.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Seus Direitos</h2>
              <p>
                Você tem o direito de acessar, corrigir ou excluir suas informações pessoais a qualquer momento.
                Entre em contato com o administrador do sistema para exercer esses direitos.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Alterações nesta Política</h2>
              <p>
                Podemos atualizar esta Política de Privacidade periodicamente. Recomendamos que você revise
                esta página regularmente para se manter informado sobre quaisquer mudanças.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Contato</h2>
              <p>
                Para questões sobre esta Política de Privacidade, entre em contato através dos canais
                oficiais da Regional Vale do Paraíba I - SP.
              </p>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t text-sm text-muted-foreground">
            <p>Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PoliticaPrivacidade;
