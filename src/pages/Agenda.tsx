import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Agenda = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold text-foreground">
            Agenda Regional Vale do Paraíba I - SP
          </h1>
        </div>

        <div className="w-full bg-card rounded-lg shadow-lg overflow-hidden">
          <iframe
            src="https://calendar.google.com/calendar/embed?src=3db053177f24bf333254be1f501c71880940cc1eb0e319bf3d45830ba4cbea07%40group.calendar.google.com&ctz=America/Sao_Paulo"
            className="w-full h-[600px] md:h-[700px] lg:h-[800px] border-0"
            frameBorder="0"
            scrolling="no"
            title="Agenda Regional VP1"
          />
        </div>
      </div>
    </div>
  );
};

export default Agenda;
