# Landing page VSL — Dendezeiros Vila Comercial

Página única, estática e leve para campanhas de Instagram/Facebook. O visitante assiste à apresentação vertical (9:16) e, depois de 30 s de reprodução efetiva, o botão **FALAR COM UM CORRETOR AGORA** aparece e abre o WhatsApp da Feira Imob com mensagem pronta.

- Abaixo do vídeo: seção da vila (foto real + ilustração), **modelos de loja** (cards gerados a partir de `stores` em `site.config.js`), planta de implantação e uma segunda chamada **FALAR COM O CORRETOR**, sempre ativa.
- Sem `youtubeId`, a página mostra a ilustração com "Vídeo em breve" e libera o botão desde o início.
- Imagens em `public/img/` (logo, vila, fachada, implantação e uma foto por modelo de loja). Para trocar a foto de um modelo, substitua o arquivo ou ajuste `stores[].image`.
- Sem backend, sem banco de dados, **sem dependências npm** (só Node 18+ para o build).
- Compatível com Cloudflare Pages: build `npm run build`, saída `dist`.

## Estrutura

```
site.config.js          ← TUDO que se edita: textos, status, vídeo, regra do CTA, WhatsApp, Pixel
src/index.html          modelo da página (os {{tokens}} vêm do site.config.js)
src/style.css           estilos (mobile-first)
src/js/main.js          inicialização: CTA, WhatsApp, eventos, consentimento
src/js/player.js        YouTube IFrame API + botão acessível (play / ativar som / pausar)
src/js/watch-tracker.js contagem de tempo efetivamente assistido
src/js/cta-rule.js      regras de liberação (imediato / segundos / percentual)
src/js/tracking.js      Meta Pixel (com consentimento), dataLayer e UTMs
src/js/whatsapp.js      geração do link wa.me (encodeURIComponent)
public/                 arquivos copiados como estão: _headers, privacidade.html, og.jpg, favicon, img/
scripts/build.mjs       build → dist/
scripts/dev.mjs         servidor local com rebuild automático
tests/                  testes unitários e de build (npm test) + testes de navegador (opcional)
```

## Rodar localmente

```bash
npm run dev        # http://localhost:5173 — refaz o build ao salvar (recarregue a página)
npm run build      # gera dist/
npm run preview    # serve dist/ sem observar mudanças
npm test           # testes de contagem, regras do CTA, link do WhatsApp e build
```

Parâmetros úteis na URL:

| Parâmetro | Efeito |
|---|---|
| `?debug` | mostra no console cada evento e a liberação do CTA |
| `?cta=immediate` | botão liberado desde o início |
| `?cta=seconds:20` | libera após 20 s assistidos |
| `?cta=percent:50` | libera após 50% do vídeo assistido |

> Para testar de novo o bloqueio na mesma aba, limpe o `sessionStorage` (o desbloqueio fica lembrado durante a sessão para quem volta do WhatsApp) ou use uma aba anônima.

## Configurações editáveis (`site.config.js`)

- **Status do empreendimento**: `project.status` (ex.: troque para "Lançamento oficial" quando ocorrer).
- **Textos**: `copy.*` — título, subtítulo, chamada, botão, aviso legal, rodapé.
- **Vídeo**: `video.youtubeId` — para testar outro vídeo, troque só o ID.
- **Regra do CTA (A/B)**: `cta.mode` = `'immediate' | 'seconds' | 'percent'`, com `cta.seconds` (padrão 30) e `cta.percent`. Se o vídeo for mais curto que o limite, o botão libera ao chegar a 90% dele.
- **WhatsApp**: `whatsapp.number`, `whatsapp.message`, `whatsapp.appendCampaignRef` (acrescenta `Ref: campanha/conteúdo` quando a URL tem UTMs).
- **Foto de fundo**: `media.backgroundImage` — coloque em `public/img/` somente fotos **autorizadas para uso comercial**. Vazio = fundo gráfico.
- **Altura do vídeo**: variável `--video-h` em `src/style.css` (no celular, 58% da altura da tela, para o vídeo caber inteiro na primeira tela).

Depois de editar: `npm run build` (ou o Cloudflare refaz sozinho, no deploy via GitHub).

## Como funciona a liberação do botão

- A contagem usa a posição real do vídeo informada pela API do YouTube (amostras a cada 0,25 s).
- Só conta enquanto o vídeo está **reproduzindo**; pausa congela a contagem; tempo parado na página não conta.
- Retroceder e rever não soma de novo; arrastar para frente não conta o trecho pulado.
- **Nunca trava o visitante**: o link discreto "Já conhece o projeto? Fale direto com um corretor" está sempre disponível, e o botão principal é liberado automaticamente se a API do YouTube não carregar (10 s), se o vídeo der erro, se o JavaScript falhar ou se o navegador não suportar os recursos usados. Sem JavaScript, o botão aparece desde o início.

## Publicar no Cloudflare Pages (subdomínio gratuito `.pages.dev`)

### Opção 1 — Upload direto (mais simples para o primeiro teste)

1. No computador: `npm run build` (gera a pasta `dist`). Se não tiver Node instalado, use o `dist` já entregue.
2. Acesse **dash.cloudflare.com → Workers & Pages → Create → Pages → Upload assets** (pode aparecer como "Drag and drop your files").
3. Dê o nome do projeto (ex.: `dendezeiros`) → arraste a **pasta `dist`** (ou o zip) → **Deploy**.
4. A página fica em `https://dendezeiros.pages.dev`. Para atualizar, faça novo upload em **Create deployment**.

Nessa opção o Pixel ID precisa estar em `site.config.js` (`tracking.metaPixelId`) antes do `npm run build`, pois não há etapa de build no Cloudflare.

### Opção 2 — GitHub com deploy automático

1. Suba este projeto para um repositório (a pasta `dist` fica fora, pelo `.gitignore`).
2. **Workers & Pages → Create → Pages → Connect to Git** → escolha o repositório.
3. Configuração: *Framework preset* **None**, *Build command* `npm run build`, *Build output directory* `dist`.
4. Em **Settings → Variables and Secrets** (ambiente de produção) adicione `META_PIXEL_ID` = ID do Pixel. Opcional: `NODE_VERSION` = `20`.
5. Cada push no branch principal publica automaticamente; branches geram URLs de prévia.

Depois de publicar, atualize `site.url` em `site.config.js` com a URL final (usada no Open Graph). Os nomes dos menus do painel da Cloudflare podem variar um pouco.

### Opção 3 — Wrangler (linha de comando)

Configuração em `wrangler.toml` (sem credenciais). Pelo seu computador, com Node 20+:

```bash
npx wrangler login        # OAuth: aprova no navegador, uma única vez
npm run deploy:check      # testes + build + confere login e projeto — NÃO publica
npm run deploy            # testes + build + cria o projeto se faltar + publica
```

O deploy roda `npx wrangler pages deploy dist --project-name dendezeiros`. Se qualquer teste falhar, nada é publicado. Uso apenas manual/emergencial: a publicação oficial é a integração do Cloudflare Pages com o GitHub.

### Publicação oficial: Cloudflare Pages + GitHub

Cada push no branch `main` de `franklindelusio/dendezeiros` é publicado pelo próprio Cloudflare Pages. O `npm run build` roda os testes unitários antes (script `prebuild`): se algum falhar, o build do Cloudflare falha e o site continua na versão anterior. O GitHub Actions (`.github/workflows/testes.yml`) roda os testes unitários e os de navegador em cada push e pull request — ele não publica.

## Meta Pixel e eventos

Pixel: conjunto de dados **FEIRAIMOB** (`840355202407276`, conta principal de anúncios; substituiu o Pixel de Feira Imob `251950683506212` em 02/11/2026), em `site.config.js` → `tracking.metaPixelId`. O ID do Pixel é público por natureza (fica visível no código de qualquer página), não é credencial. Se a variável `META_PIXEL_ID` existir no ambiente de build, ela tem prioridade.

O Pixel **só é carregado depois que o visitante aceita** na barra discreta de consentimento (LGPD). A escolha fica salva no navegador e pode ser alterada em "Preferências de cookies", no rodapé. Eventos que acontecem antes da resposta ficam só na memória da página: são enviados se a pessoa aceitar e descartados se recusar.

| Evento | Tipo no Pixel | Quando dispara |
|---|---|---|
| `PageView` | padrão | ao carregar (se já aceitou) ou no momento do aceite — uma vez por página |
| `Contact` | padrão | **somente no clique** no botão do WhatsApp ou no link secundário. Liberar o botão não dispara nada; duplo toque conta uma vez |
| `VideoEngaged30s` | personalizado | 30 s de reprodução **efetiva** do vídeo (pausa, tempo parado, trechos pulados e revistos não contam) — uma vez por visualização da página |
| `VideoStart` | personalizado | primeira reprodução |
| `VideoProgress25` / `50` / `75` | personalizado | 25/50/75% do vídeo efetivamente assistido |
| `VideoComplete` | personalizado | fim do vídeo |

Parâmetros enviados (lista fixa, nada pessoal): `cta_rule`, `video_id`, `utm_*` presentes, e no `Contact` também `content_name`, `placement` (`primary`/`secondary`) e `cta_unlocked`. Qualquer outro campo é descartado, assim como valores que pareçam e-mail ou telefone. Os eventos automáticos de clique do Pixel (`autoConfig`) ficam desligados para não duplicar o `Contact`, e não é enviada correspondência avançada. Recomenda-se manter a **correspondência avançada automática desligada** também no Gerenciador de Eventos.

### Usar o clique no WhatsApp como conversão

1. Com o site publicado, abra **Gerenciador de Eventos → conjunto de dados FEIRAIMOB → Testar eventos**, informe a URL da página, aceite os cookies e toque no botão do WhatsApp.
2. Confirme que `PageView` e `Contact` chegaram (e `VideoEngaged30s`, se assistir 30 s).
3. Na campanha, escolha o evento **Contato (Contact)** do conjunto de dados FEIRAIMOB como evento de conversão. Como o mesmo Pixel pode estar em outros sites da Feira Imob, para medir só esta página crie uma **Conversão personalizada**: evento `Contact` + regra de URL contém `dendezeiros`.
4. `VideoEngaged30s` pode virar conversão personalizada para públicos (ex.: pessoas que assistiram 30 s).

### UTMs

Use links como:
`https://dendezeiros.pages.dev/?utm_source=instagram&utm_medium=paid&utm_campaign=lancamento&utm_content=reels01`

Os UTMs ficam guardados durante a sessão, acompanham todos os eventos e, por padrão, entram no fim da mensagem do WhatsApp como `Ref: lancamento/reels01` (sem acentos, até 40 caracteres) para o corretor saber a origem.

## Testes

- `npm test`: 21 testes (contagem efetiva, regras A/B, link do WhatsApp, eventos do Pixel, consentimento, filtro de parâmetros, build).
- Testes de navegador (opcional): `npm i -D playwright && npx playwright install chromium && node tests/e2e/run.mjs`. Simulam o YouTube e o Pixel localmente em iPhone, Android, iPad e desktop (57 verificações) e salvam capturas em `tests/e2e/screens/`.

### Checklist de validação manual (antes de rodar anúncios)

- [ ] iPhone (Safari **e** navegador interno do Instagram): vídeo vertical aparece inteiro, sem cortes, com marca e controles do YouTube.
- [ ] Android (Chrome **e** navegador interno do Instagram/Facebook): idem.
- [ ] Desktop (Chrome, Safari/Edge): duas colunas, vídeo à direita.
- [ ] Autoplay mudo inicia (ou, se bloqueado, o botão "Assistir apresentação" funciona).
- [ ] "Ativar som" liga o áudio; "Pausar" pausa; a contagem para durante a pausa.
- [ ] Após ~30 s assistidos o botão principal aparece; antes disso, só o link secundário.
- [ ] Botão abre o **app** do WhatsApp no celular e o WhatsApp Web/Desktop no computador, com a mensagem preenchida e o número correto.
- [ ] Com o Pixel: barra de consentimento aparece; ao aceitar, eventos chegam em **Testar eventos**; ao recusar, nada é enviado.
- [ ] Velocidade: PageSpeed Insights (mobile) e teste em 4G real.
- [ ] Prévia de compartilhamento (Open Graph): https://developers.facebook.com/tools/debug/
- [ ] Console do navegador sem erros (ignorar avisos internos do próprio player do YouTube).

## Pendências para ativar

1. Pixel configurado (`840355202407276`). Validar em **Testar eventos** após a publicação.
2. Revisar o texto de `public/privacidade.html` (modelo inicial) e o aviso legal com o jurídico/compliance da Feira Imob — incluir CNPJ e canal formal do encarregado de dados, se aplicável.
3. Confirmar a redação do status ("lançamento previsto para novembro de 2026") — já estamos em novembro.
4. Opcional: fotos autorizadas para `media.backgroundImage` e uma imagem de compartilhamento definitiva em `public/og.jpg` (1200×630).
5. Opcional: verificar o domínio no Gerenciador de Negócios do Meta quando houver domínio próprio.

## Notas técnicas

- O build não usa Vite porque o ambiente onde a página foi feita não tinha acesso ao registro npm; com isso o projeto não tem nenhuma dependência para instalar ou quebrar. A estrutura (HTML + CSS + módulos ES) é compatível com Vite se quiserem migrar depois.
- Fontes: Cormorant Garamond e Manrope via Google Fonts (`display=swap`, com fontes do sistema como alternativa).
- Player em `youtube-nocookie.com` (privacidade aprimorada), com `playsinline` para não abrir em tela cheia no iPhone.
- `public/_headers` define cabeçalhos de segurança e cache com revalidação; os arquivos são versionados por hash a cada build.
