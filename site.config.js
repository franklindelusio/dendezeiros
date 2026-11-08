/**
 * VILA COMERCIAL DENDEZEIROS — CONFIGURAÇÃO CENTRAL
 * ------------------------------------------------------------
 * Tudo o que muda com frequência fica aqui: textos, status, vídeo,
 * modelos de loja, regra de liberação do CTA, WhatsApp e rastreamento.
 * Depois de editar, rode `npm run build`.
 */
export default {
  site: {
    lang: 'pt-BR',
    // URL pública final (usada nas tags Open Graph). Atualize após publicar.
    url: 'https://dendezeiros.pages.dev',
    title: 'Dendezeiros Vila Comercial — Lojas em Praia do Forte, Bahia',
    description:
      'Conheça a Vila Comercial Dendezeiros, em Praia do Forte: lojas de 17 m² a 60 m² numa vila baiana em meio aos dendezeiros. Lojas a partir de R$ 206 mil, com sinal de 10% e saldo em 36 vezes.',
    ogImage: '/og.jpg',
    themeColor: '#14302A',
  },

  project: {
    name: 'Dendezeiros Vila Comercial',
    location: 'Praia do Forte, Mata de São João — Bahia, às margens da BR-099',
    builder: 'Fazenda Praia do Forte · Projeto Alberto Bolzico & Associados',
    // Atualize aqui quando o status mudar.
    status: 'Praia do Forte · Lojas à venda',
    priceFrom: 'Lojas a partir de R$ 206 mil · sinal de 10% + 36 parcelas',
    payment: 'Sinal de 10% e o restante em 36 parcelas, conforme tabela vigente',
  },

  copy: {
    brand: 'DENDEZEIROS',
    headline: 'Sua loja numa autêntica vila baiana em Praia do Forte.',
    subheadline:
      'Lojas a partir de R$ 206 mil, com sinal de 10% e o restante em 36 vezes. Em meio aos dendezeiros, ao lado do Parque Municipal.',
    videoLabel: 'Apresentação da Vila Comercial Dendezeiros',
    lockedHint: 'Assista à apresentação para conhecer melhor a vila.',
    unlockedAnnouncement: 'O botão para falar com um corretor está disponível.',
    ctaTitle: 'Gostou da Dendezeiros?',
    ctaText:
      'Converse com um corretor da Feira Imob e veja as lojas disponíveis e as condições de pagamento.',
    ctaButton: 'FALAR COM UM CORRETOR AGORA',
    secondaryLink: 'Já conhece a vila? Fale direto com um corretor',
    videoFallback: 'Não foi possível carregar o vídeo aqui.',
    videoFallbackLink: 'Assistir no YouTube',
    videoSoon: 'Vídeo de apresentação em breve',

    vilaKicker: 'A vila',
    vilaTitle: 'Elegância e funcionalidade no meio da natureza.',
    vilaText:
      'Casinhas de telha colonial, janelas coloridas e uma praça central cercada por vegetação exuberante. Um ponto de serviços, gastronomia e lazer com vagas de estacionamento e bicicletário, na via que leva à vila de Praia do Forte.',
    vilaPhotoCaption: 'Foto real da entrada da vila',
    vilaRenderCaption: 'Ilustração artística da vila',

    lojasKicker: 'Modelos de loja',
    lojasTitle: 'Escolha o tamanho do seu negócio.',
    lojasNote: 'Valores da tabela vigente, sujeitos a disponibilidade. Imagens ilustrativas.',

    mapaKicker: 'Implantação',
    mapaTitle: 'Cada loja voltada para a praça e para o verde.',
    mapaText:
      'A vila ocupa um terreno entre a Rua das Flores e a BR-099, com acesso pela via que leva à Fazenda e à praia, e faz divisa com o Parque Municipal Arquiteto Wilson Reis Netto.',

    cta2Title: 'Quer saber quais lojas ainda estão disponíveis?',
    cta2Text: 'Sinal de 10% e o restante em 36 vezes. Um corretor da Feira Imob te mostra a tabela e a localização de cada loja na vila.',
    cta2Button: 'FALAR COM O CORRETOR',

    disclaimer:
      'Imagens, ilustrações e vídeo de caráter ilustrativo. Valores, metragens, condições de pagamento e disponibilidade sujeitos a alteração e confirmação conforme tabela vigente. Este material não constitui oferta nem garantia de valorização ou rentabilidade.',
    footer: 'Feira Imob Imobiliária — CRECI 20462 (corretor responsável).',
  },

  // Itens curtos mostrados como etiquetas na seção "A vila".
  highlights: ['Serviços', 'Gastronomia', 'Lazer', 'Vagas de estacionamento', 'Bicicletário', 'Praça central'],

  /**
   * Modelos de loja (seção "Escolha sua loja").
   * Ajuste preços/metragens quando a tabela mudar.
   */
  stores: [
    {
      name: 'Loja térrea',
      area: '32,60 a 33,51 m²',
      detail: 'Térreo de cerca de 33 m², distribuído ao longo da vila. A tipologia com mais opções disponíveis.',
      price: 'A partir de R$ 371.640',
      image: '/img/loja-terrea.jpg',
      tag: '',
    },
    {
      name: 'Loja com mezanino',
      area: '32,60 a 43,53 m² + mezanino de ~17 m²',
      detail: 'Até 60 m² no total, com mezanino para estoque, escritório ou um segundo ambiente.',
      price: 'A partir de R$ 301.900',
      image: '/img/loja-mezanino.jpg',
      tag: 'Mais espaço',
    },
    {
      name: 'Loja compacta',
      area: '17,22 m²',
      detail: 'No miolo da vila, junto à praça central. Ideal para café, sorveteria, quiosque ou serviço rápido.',
      price: 'A partir de R$ 206.640',
      image: '/img/loja-compacta.jpg',
      tag: 'Menor investimento',
    },
  ],

  media: {
    logo: '/img/logo.png',
    vila: '/img/vila.jpg',
    photo: '/img/fachada.jpg',
    plan: '/img/implantacao.jpg',
  },

  video: {
    // ID do vídeo no YouTube (ex.: 'g8UmuXhZ55Y'). Vazio = mostra a ilustração
    // com "Vídeo em breve" e o botão do WhatsApp liberado desde o início.
    youtubeId: '6G0EiI1_WBg',
    autoplayMuted: true,
    privacyEnhanced: true,
    apiTimeoutMs: 10000,
  },

  /**
   * Regra de liberação do botão principal (teste A/B):
   *   mode: 'immediate' | 'seconds' | 'percent'
   * Com allowUrlOverride: ?cta=immediate | ?cta=seconds:20 | ?cta=percent:50
   */
  cta: {
    mode: 'seconds',
    seconds: 30,
    percent: 50,
    allowUrlOverride: true,
    rememberUnlock: true,
  },

  whatsapp: {
    number: '5571996095022',
    message:
      'Olá! Vi a apresentação da Vila Comercial Dendezeiros, em Praia do Forte, e gostaria de conversar com um corretor sobre as lojas disponíveis e as condições de pagamento.',
    appendCampaignRef: true,
  },

  tracking: {
    // Conjunto de dados FEIRAIMOB (Meta). META_PIXEL_ID no build tem prioridade.
    metaPixelId: '840355202407276',
    requireConsent: true,
  },
};
