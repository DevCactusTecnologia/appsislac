/**
 * Respostas SOAP/XML mockadas — Hermes Pardini.
 *
 * Estrutura compatível com o WS Multiapoio público. Usadas pela camada
 * de transporte MOCK até a habilitação do ambiente de homologação real.
 */

export function mockVerificarRecebimentoXml(numeroPedido: string): string {
  // 70% recebido, 30% em trânsito — determinístico por hash simples
  const recebido = (numeroPedido.length + numeroPedido.charCodeAt(0)) % 10 < 7;
  const data = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:hp="http://hermespardini.com.br/multiapoio">
  <soapenv:Body>
    <hp:verificarRecebimentoPedidoResponse>
      <hp:numeroPedido>${numeroPedido}</hp:numeroPedido>
      <hp:recebido>${recebido}</hp:recebido>
      <hp:situacao>${recebido ? "RECEBIDO" : "EM_TRANSITO"}</hp:situacao>
      <hp:dataRecebimento>${recebido ? data : ""}</hp:dataRecebimento>
      <hp:mensagem>${recebido ? "Pedido recebido com sucesso" : "Aguardando recebimento"}</hp:mensagem>
    </hp:verificarRecebimentoPedidoResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export function mockGetResultadoPedidoXml(numeroPedido: string): string {
  const now = new Date();
  const dataEmissao = now.toISOString().slice(0, 10);
  const horaEmissao = now.toISOString().slice(11, 19);
  // Resultados v1.2 — estrutura conforme Resultados.xsd oficial Hermes Pardini.
  // O laudo vai dentro de <resultadoXml> com CDATA, padrão observado em
  // homologação para preservar XML embarcado no envelope SOAP.
  const resultadosXml = `<?xml version="1.0" encoding="UTF-8"?>
<Resultados>
  <Protocolo>12</Protocolo>
  <ID>SISLAC-${numeroPedido}</ID>
  <ControleDeLote>
    <Emissor>HERMES PARDINI</Emissor>
    <DataEmissao>${dataEmissao}</DataEmissao>
    <HoraEmissao>${horaEmissao}</HoraEmissao>
    <Periodo>
      <DataInicial>${dataEmissao}</DataInicial>
      <HoraInicial>00:00:00</HoraInicial>
      <DataFinal>${dataEmissao}</DataFinal>
      <HoraFinal>${horaEmissao}</HoraFinal>
    </Periodo>
    <CodLab>SISLAC</CodLab>
  </ControleDeLote>
  <Pedido>
    <CodPedApoio>${numeroPedido.padStart(7, "0").slice(-7)}</CodPedApoio>
    <CodPedLab>${numeroPedido}</CodPedLab>
    <Nome>PACIENTE TESTE MOCK</Nome>
    <SuperExame>
      <MaterialNome>Sangue total / EDTA</MaterialNome>
      <ExameNome>HEMOGRAMA COMPLETO</ExameNome>
      <CodExmApoio>SG|HEMOG|1</CodExmApoio>
      <CodExmLab>HEMOG</CodExmLab>
      <CodigoFormato>HEMOG-1.0</CodigoFormato>
      <Exame idExame="1">
        <InfAdicional idInfAdicional="1">
          <Descricao>Tempo de jejum</Descricao>
          <Valor Tipo="alfanumerico" idValor="1">8h</Valor>
        </InfAdicional>
        <ItemDeExame idItemDeExame="1">
          <Nome>Hemoglobina</Nome>
          <Metodo>Citometria de fluxo</Metodo>
          <Resultado idResultado="1">
            <Conteudo>
              <Valor Tipo="decimal" CasasDecimais="1" idValor="1">14.2</Valor>
            </Conteudo>
            <UnidadeDeMedida>g/dL</UnidadeDeMedida>
            <ValorDeReferencia>
              <Tabela>
                <Linha idLinha="1">
                  <Categoria1>HOMEM</Categoria1>
                  <Valor1>13.0</Valor1>
                  <Valor2>17.0</Valor2>
                  <UnidadeDoValor>g/dL</UnidadeDoValor>
                </Linha>
                <Linha idLinha="2">
                  <Categoria1>MULHER</Categoria1>
                  <Valor1>12.0</Valor1>
                  <Valor2>15.5</Valor2>
                  <UnidadeDoValor>g/dL</UnidadeDoValor>
                </Linha>
              </Tabela>
            </ValorDeReferencia>
          </Resultado>
        </ItemDeExame>
        <ItemDeExame idItemDeExame="2">
          <Nome>Hematócrito</Nome>
          <Resultado idResultado="1">
            <Conteudo>
              <Valor Tipo="decimal" CasasDecimais="1" idValor="1">42.5</Valor>
            </Conteudo>
            <UnidadeDeMedida>%</UnidadeDeMedida>
            <ValorDeReferencia>
              <Tabela>
                <Linha idLinha="1">
                  <Categoria1>HOMEM</Categoria1>
                  <Valor1>40</Valor1>
                  <Valor2>50</Valor2>
                  <UnidadeDoValor>%</UnidadeDoValor>
                </Linha>
                <Linha idLinha="2">
                  <Categoria1>MULHER</Categoria1>
                  <Valor1>36</Valor1>
                  <Valor2>46</Valor2>
                  <UnidadeDoValor>%</UnidadeDoValor>
                </Linha>
              </Tabela>
            </ValorDeReferencia>
          </Resultado>
        </ItemDeExame>
        <ItemDeExame idItemDeExame="3">
          <Nome>Leucócitos</Nome>
          <Resultado idResultado="1">
            <Conteudo>
              <Valor Tipo="decimal" CasasDecimais="0" idValor="1">7200</Valor>
            </Conteudo>
            <UnidadeDeMedida>/mm³</UnidadeDeMedida>
            <ValorDeReferencia>
              <Valor Tipo="alfanumerico">4.000 a 11.000 /mm³</Valor>
            </ValorDeReferencia>
          </Resultado>
          <Observacao>Sem alterações morfológicas significativas.</Observacao>
        </ItemDeExame>
      </Exame>
    </SuperExame>
    <SuperExame>
      <MaterialNome>Soro</MaterialNome>
      <ExameNome>GLICOSE</ExameNome>
      <CodExmApoio>SR|GLIC|1</CodExmApoio>
      <CodExmLab>GLIC</CodExmLab>
      <CodigoFormato>GLIC-1.0</CodigoFormato>
      <Exame idExame="1">
        <ItemDeExame idItemDeExame="1">
          <Nome>Glicose</Nome>
          <Metodo>Enzimático</Metodo>
          <Resultado idResultado="1">
            <Conteudo>
              <Valor Tipo="decimal" CasasDecimais="0" idValor="1">92</Valor>
            </Conteudo>
            <UnidadeDeMedida>mg/dL</UnidadeDeMedida>
            <ValorDeReferencia>
              <Valor Tipo="alfanumerico">70 - 99 mg/dL</Valor>
            </ValorDeReferencia>
          </Resultado>
        </ItemDeExame>
      </Exame>
    </SuperExame>
  </Pedido>
</Resultados>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:hp="http://hermespardini.com.br/b2b/apoio/schemas">
  <soapenv:Body>
    <hp:getResultadoPedidoResponse>
      <hp:numeroPedido>${numeroPedido}</hp:numeroPedido>
      <hp:resultadoXml><![CDATA[${resultadosXml}]]></hp:resultadoXml>
    </hp:getResultadoPedidoResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}