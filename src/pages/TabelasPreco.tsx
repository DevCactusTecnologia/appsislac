import TabelasPrecoTab from "@/components/configuracoes/TabelasPrecoTab";
import DomainBreadcrumb from "@/components/shared/DomainBreadcrumb";
import { useParams } from "react-router-dom";

const TabelasPrecoPage = () => {
  const { id } = useParams();
  const items = [{ label: "Tabelas de Preço", to: "/tabelas-preco" }];
  if (id) items.push({ label: `Tabela ${id}`, to: `/tabelas-preco/${id}` });
  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-4">
        <DomainBreadcrumb items={items} />
        <TabelasPrecoTab />
      </div>
    </div>
  );
};

export default TabelasPrecoPage;
