/**
 * Boot do Provider UI Registry.
 *
 * Importar este arquivo em qualquer entrypoint ativa o registro
 * declarativo de TODOS os providers conhecidos. Cada barrel é
 * inerte por si só (apenas declarações + chamadas a register*).
 */

import "./hermes-pardini/ui";
import "./dbsync/ui";

export { listProviderUIs, getProviderUI } from "../contracts/providerUI";