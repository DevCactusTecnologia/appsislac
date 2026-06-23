# Cleanup 1.0 — Fase 6: Assets, Public e Binários

> Documentação. **Nada movido.**

## `src/assets/` (1,4 MB)

| Arquivo | Tamanho | Uso provável |
|---------|--------:|--------------|
| `hero-flower.png` | **810 KB** | Landing — único binário grande |
| `favicon.png` | 13 KB | Favicon |
| `landing/hero-team.jpg` | 159 KB | Landing pública |
| `landing/servico-coleta.jpg` | 130 KB | Landing |
| `landing/servico-exames.jpg` | 55 KB | Landing |
| `landing/servico-resultados.jpg` | 59 KB | Landing |
| `landing/servico-unidades.jpg` | 55 KB | Landing |
| `landing/sobre-lab.jpg` | 48 KB | Landing |
| `landing/unidade-clinica.jpg` | 37 KB | Landing |
| `landing/unidade-matriz.jpg` | 44 KB | Landing |
| `landing/unidade-shopping.jpg` | 55 KB | Landing |

## `public/` (5,5 KB)

`llms.txt`, `placeholder.svg`, `robots.txt`, `sitemap.xml`. Saudável.

## Observação

`hero-flower.png` (810 KB) é o maior binário do repo. Candidato a:
- Compressão (WebP/AVIF) para reduzir < 200 KB.
- Migração para CDN via skill `migrate-to-assets` se for confirmado uso
  estável.

**Nenhuma ação executada.** Documentado para Fase 2 de Cleanup.
