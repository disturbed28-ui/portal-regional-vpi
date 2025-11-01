import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const TermosServico = () => {
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
          <h1 className="text-3xl font-bold mb-6">Termos de Serviço</h1>
          
          <div className="space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Aceitação dos Termos</h2>
              <p>
                Ao acessar e utilizar o Portal Regional Vale do Paraíba I - SP, você concorda com estes
                Termos de Serviço. Se você não concordar com qualquer parte destes termos, não deverá
                utilizar a plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Descrição do Serviço</h2>
              <p>
                O Portal Regional é uma plataforma de gestão interna destinada a membros da Regional
                Vale do Paraíba I - SP, oferecendo funcionalidades de organização, comunicação,
                gerenciamento de eventos e relatórios administrativos.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Cadastro e Conta de Usuário</h2>
              <p>
                Para utilizar o sistema, você deve:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Ser membro autorizado da organização</li>
                <li>Fornecer informações verdadeiras e atualizadas</li>
                <li>Manter a confidencialidade de suas credenciais de acesso</li>
                <li>Notificar imediatamente sobre qualquer uso não autorizado de sua conta</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Uso Aceitável</h2>
              <p>
                Você concorda em utilizar o Portal apenas para fins legítimos relacionados às atividades
                da organização. É proibido:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Utilizar o sistema para fins ilegais ou não autorizados</li>
                <li>Tentar acessar áreas restritas sem permissão</li>
                <li>Interferir no funcionamento normal da plataforma</li>
                <li>Compartilhar informações confidenciais com terceiros não autorizados</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Propriedade Intelectual</h2>
              <p>
                Todo o conteúdo, recursos e funcionalidades do Portal são propriedade da organização
                e estão protegidos por leis de direitos autorais e propriedade intelectual.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Privacidade</h2>
              <p>
                O uso de suas informações pessoais é regido por nossa Política de Privacidade,
                que pode ser consultada separadamente.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Modificações do Serviço</h2>
              <p>
                Reservamo-nos o direito de modificar, suspender ou descontinuar qualquer aspecto
                do Portal a qualquer momento, com ou sem aviso prévio.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Limitação de Responsabilidade</h2>
              <p>
                O Portal é fornecido "como está". Não garantimos que o serviço será ininterrupto,
                seguro ou livre de erros. Em nenhuma circunstância seremos responsáveis por danos
                indiretos, incidentais ou consequenciais.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Alterações nos Termos</h2>
              <p>
                Podemos revisar estes Termos de Serviço periodicamente. O uso continuado do Portal
                após tais alterações constitui sua aceitação dos novos termos.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">10. Contato</h2>
              <p>
                Para questões sobre estes Termos de Serviço, entre em contato através dos canais
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

export default TermosServico;
