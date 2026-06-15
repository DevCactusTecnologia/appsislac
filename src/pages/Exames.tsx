import ExamesTab from "@/components/configuracoes/ExamesTab";
import DomainBreadcrumb from "@/components/shared/DomainBreadcrumb";
import { useParams } from "react-router-dom";

/**
 * Domain Driven Route — Exames (Fase B).
 * Reusa o componente ExamesTab das Configurações sem duplicar lógica.
 * CRUD continua acontecendo pelos diálogos internos do componente.
 */
const ExamesPage = () => {
  const { id, modelId } = useParams();
  const items = [{ label: "Exames", to: "/exames" }];
  if (id) items.push({ label: `Exame ${id}`, to: `/exames/${id}` });
  if (modelId) items.push({ label: "Modelos", to: `/exames/${id}/modelos` });
  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-4">
        <DomainBreadcrumb items={items} />
        <ExamesTab />
      </div>
    </div>
  );
};

export default ExamesPage;
