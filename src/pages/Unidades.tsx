import UnidadesTab from "@/components/configuracoes/UnidadesTab";
import DomainBreadcrumb from "@/components/shared/DomainBreadcrumb";
import { useParams } from "react-router-dom";

const UnidadesPage = () => {
  const { id } = useParams();
  const items = [{ label: "Unidades", to: "/unidades" }];
  if (id) items.push({ label: `Unidade ${id}`, to: `/unidades/${id}` });
  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-4">
        <DomainBreadcrumb items={items} />
        <UnidadesTab />
      </div>
    </div>
  );
};

export default UnidadesPage;
