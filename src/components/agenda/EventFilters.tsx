import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EventFiltersProps {
  selectedType: string;
  selectedDivision: string;
  onTypeChange: (value: string) => void;
  onDivisionChange: (value: string) => void;
  availableTypes: string[];
  availableDivisions: string[];
}

export function EventFilters({
  selectedType,
  selectedDivision,
  onTypeChange,
  onDivisionChange,
  availableTypes,
  availableDivisions,
}: EventFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1">
        <Select value={selectedType} onValueChange={onTypeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {availableTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex-1">
        <Select value={selectedDivision} onValueChange={onDivisionChange}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrar por divisão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as divisões</SelectItem>
            {availableDivisions.map((division) => (
              <SelectItem key={division} value={division}>
                {division}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
