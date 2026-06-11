
INSERT INTO public.tenant_pages (tenant_id, slug, titulo, publicado, conteudo)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'home',
  'Página inicial',
  true,
  '[
    {
      "type": "hero",
      "props": {
        "titulo": "Laboratório Demo",
        "subtitulo": "Análises clínicas com agilidade, segurança e atendimento humanizado.",
        "ctaTexto": "Solicitar exames",
        "ctaHref": "#exames",
        "imagemUrl": ""
      }
    },
    {
      "type": "texto",
      "props": {
        "heading": "Sobre nós",
        "texto": "Somos um laboratório referência em diagnósticos clínicos. Atendemos pacientes particulares e por convênio com tecnologia de ponta e equipe especializada."
      }
    },
    {
      "type": "exames_lista",
      "props": {
        "titulo": "Nossos exames",
        "mostrarPreco": true,
        "apenasDestaque": false,
        "layout": "grid"
      }
    }
  ]'::jsonb
)
ON CONFLICT (tenant_id, slug) DO UPDATE
  SET publicado = EXCLUDED.publicado,
      conteudo = EXCLUDED.conteudo,
      titulo = EXCLUDED.titulo,
      updated_at = now();
