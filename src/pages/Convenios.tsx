import ConveniosTab from "@/components/configuracoes/ConveniosTab";
import DomainBreadcrumb from "@/components/shared/DomainBreadcrumb";
import { useParams } from "react-router-dom";

const ConveniosPage = () => {
  const { id } = useParams();
  const items = [{ label: "Convênios", to: "/convenios" }];
  if (id) items.push({ label: `Convênio ${id}`, to: `/convenios/${id}` });
  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-4">
        <DomainBreadcrumb items={items} />
        <ConveniosTab />
      </div>
    </div>
  );
};

export default ConveniosPage;
