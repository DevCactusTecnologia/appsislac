import { BellRing } from "lucide-react";
import WhatsappCloudConfig from "./WhatsappCloudConfig";
import SectionShell from "./_shared/SectionShell";

const NotificacoesTab = () => {
  return (
    <SectionShell
      icon={<BellRing className="h-5 w-5" />}
      eyebrow="Comunicação"
      title="Notificações"
      description="Configure como o laboratório envia avisos automáticos para pacientes e equipe via WhatsApp Cloud API."
    >
      <WhatsappCloudConfig />
    </SectionShell>
  );
};

export default NotificacoesTab;
