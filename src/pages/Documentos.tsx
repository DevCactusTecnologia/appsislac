import DocumentosTab from "@/components/configuracoes/DocumentosTab";
import DomainBreadcrumb from "@/components/shared/DomainBreadcrumb";
import { useParams } from "react-router-dom";

const DocumentosPage = () => {
  const { id } = useParams();
  const items = [{ label: "Documentos", to: "/documentos" }];
  if (id) items.push({ label: `Documento ${id}`, to: `/documentos/${id}` });
  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-4">
        <DomainBreadcrumb items={items} />
        <DocumentosTab />
      </div>
    </div>
  );
};

export default DocumentosPage;
