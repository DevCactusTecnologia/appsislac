import { Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BLOCK_LABELS, type TBlock } from "@/lib/tenantSite/blocks";

interface Props {
  block: TBlock;
  index: number;
  total: number;
  onChange: (next: TBlock) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}

export default function BlockEditor({ block, index, total, onChange, onRemove, onMove }: Props) {
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold text-foreground">
          {index + 1}. {BLOCK_LABELS[block.type]}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            title="Mover para cima"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            title="Mover para baixo"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            title="Remover bloco"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {block.type === "hero" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Título">
              <Input
                value={block.props.titulo}
                onChange={(e) =>
                  onChange({ ...block, props: { ...block.props, titulo: e.target.value } })
                }
                maxLength={200}
              />
            </Field>
            <Field label="Subtítulo">
              <Input
                value={block.props.subtitulo}
                onChange={(e) =>
                  onChange({ ...block, props: { ...block.props, subtitulo: e.target.value } })
                }
                maxLength={400}
              />
            </Field>
            <Field label="Texto do botão (CTA)">
              <Input
                value={block.props.ctaTexto}
                onChange={(e) =>
                  onChange({ ...block, props: { ...block.props, ctaTexto: e.target.value } })
                }
                maxLength={60}
              />
            </Field>
            <Field label="URL do botão">
              <Input
                value={block.props.ctaUrl}
                onChange={(e) =>
                  onChange({ ...block, props: { ...block.props, ctaUrl: e.target.value } })
                }
                placeholder="app  ou  https://..."
              />
            </Field>
            <Field label="URL da imagem (opcional)" wide>
              <Input
                value={block.props.imagemUrl}
                onChange={(e) =>
                  onChange({ ...block, props: { ...block.props, imagemUrl: e.target.value } })
                }
                placeholder="https://..."
              />
            </Field>
            <Field label="Alinhamento">
              <Select
                value={block.props.alinhamento}
                onValueChange={(v) =>
                  onChange({
                    ...block,
                    props: { ...block.props, alinhamento: v as "left" | "center" },
                  })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="left">Esquerda</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}

        {block.type === "texto" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Tipo">
                <Select
                  value={block.props.nivel}
                  onValueChange={(v) =>
                    onChange({
                      ...block,
                      props: { ...block.props, nivel: v as "h2" | "h3" | "p" },
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="p">Parágrafo</SelectItem>
                    <SelectItem value="h2">Título (H2)</SelectItem>
                    <SelectItem value="h3">Subtítulo (H3)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Alinhamento">
                <Select
                  value={block.props.alinhamento}
                  onValueChange={(v) =>
                    onChange({
                      ...block,
                      props: { ...block.props, alinhamento: v as "left" | "center" | "right" },
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Esquerda</SelectItem>
                    <SelectItem value="center">Centro</SelectItem>
                    <SelectItem value="right">Direita</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Texto">
              <Textarea
                rows={4}
                value={block.props.texto}
                onChange={(e) =>
                  onChange({ ...block, props: { ...block.props, texto: e.target.value } })
                }
                maxLength={5000}
              />
            </Field>
          </div>
        )}

        {block.type === "servicos" && (
          <div className="space-y-3">
            <Field label="Título da seção">
              <Input
                value={block.props.titulo}
                onChange={(e) =>
                  onChange({ ...block, props: { ...block.props, titulo: e.target.value } })
                }
              />
            </Field>
            <div className="space-y-2">
              <Label className="text-xs">Itens</Label>
              {block.props.itens.map((it, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-start">
                  <Input
                    placeholder="Nome"
                    value={it.nome}
                    onChange={(e) => {
                      const itens = [...block.props.itens];
                      itens[i] = { ...it, nome: e.target.value };
                      onChange({ ...block, props: { ...block.props, itens } });
                    }}
                  />
                  <Input
                    placeholder="Descrição (opcional)"
                    value={it.descricao}
                    onChange={(e) => {
                      const itens = [...block.props.itens];
                      itens[i] = { ...it, descricao: e.target.value };
                      onChange({ ...block, props: { ...block.props, itens } });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => {
                      const itens = block.props.itens.filter((_, j) => j !== i);
                      onChange({ ...block, props: { ...block.props, itens } });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onChange({
                    ...block,
                    props: {
                      ...block.props,
                      itens: [...block.props.itens, { nome: "", descricao: "" }],
                    },
                  })
                }
              >
                + Adicionar item
              </Button>
            </div>
          </div>
        )}

        {block.type === "imagem" && (
          <div className="space-y-3">
            <Field label="Layout">
              <Select
                value={block.props.layout}
                onValueChange={(v) =>
                  onChange({
                    ...block,
                    props: { ...block.props, layout: v as "unica" | "galeria" },
                  })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unica">Imagem única</SelectItem>
                  <SelectItem value="galeria">Galeria</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="space-y-2">
              <Label className="text-xs">Imagens</Label>
              {block.props.imagens.map((im, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto] gap-2 items-start">
                  <Input
                    placeholder="URL"
                    value={im.url}
                    onChange={(e) => {
                      const imagens = [...block.props.imagens];
                      imagens[i] = { ...im, url: e.target.value };
                      onChange({ ...block, props: { ...block.props, imagens } });
                    }}
                  />
                  <Input
                    placeholder="Legenda"
                    value={im.legenda}
                    onChange={(e) => {
                      const imagens = [...block.props.imagens];
                      imagens[i] = { ...im, legenda: e.target.value };
                      onChange({ ...block, props: { ...block.props, imagens } });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => {
                      const imagens = block.props.imagens.filter((_, j) => j !== i);
                      onChange({ ...block, props: { ...block.props, imagens } });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onChange({
                    ...block,
                    props: {
                      ...block.props,
                      imagens: [...block.props.imagens, { url: "", legenda: "" }],
                    },
                  })
                }
              >
                + Adicionar imagem
              </Button>
            </div>
          </div>
        )}

        {block.type === "exames_lista" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Título da seção">
                <Input
                  value={block.props.titulo}
                  onChange={(e) => onChange({ ...block, props: { ...block.props, titulo: e.target.value } })}
                  maxLength={200}
                />
              </Field>
              <Field label="Layout">
                <Select
                  value={block.props.layout}
                  onValueChange={(v) => onChange({ ...block, props: { ...block.props, layout: v as "grid" | "lista" } })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grid">Grade (cards)</SelectItem>
                    <SelectItem value="lista">Lista vertical</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Descrição (opcional)" wide>
              <Textarea
                rows={2}
                value={block.props.descricao}
                onChange={(e) => onChange({ ...block, props: { ...block.props, descricao: e.target.value } })}
                maxLength={500}
              />
            </Field>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ToggleField
                label="Mostrar preço"
                checked={block.props.mostrarPreco}
                onChange={(v) => onChange({ ...block, props: { ...block.props, mostrarPreco: v } })}
              />
              <ToggleField
                label="Mostrar busca"
                checked={block.props.mostrarBusca}
                onChange={(v) => onChange({ ...block, props: { ...block.props, mostrarBusca: v } })}
              />
              <ToggleField
                label="Apenas destaques"
                checked={block.props.apenasDestaque}
                onChange={(v) => onChange({ ...block, props: { ...block.props, apenasDestaque: v } })}
              />
              <Field label="Limite">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={block.props.limite}
                  onChange={(e) => onChange({ ...block, props: { ...block.props, limite: Math.max(1, Math.min(120, Number(e.target.value) || 1)) } })}
                />
              </Field>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Os exames exibidos vêm da configuração "Exames públicos" abaixo. Apenas o preço da tabela <b>Particular</b> é exposto.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2 space-y-1" : "space-y-1"}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 border border-border rounded-md px-3 py-2">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}