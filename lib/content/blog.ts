export const BLOG_LOCALES = ["en", "pt-br", "es"] as const;
export type BlogLocale = (typeof BLOG_LOCALES)[number];

export type BlogPost = {
  slug: string;
  locale: BlogLocale;
  title: string;
  excerpt: string;
  body: string[];
  coverImage?: string;
  publishAt: string;
  tags?: string[];
};

type BlogIndexCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  emptyState: string;
  backLabel: string;
};

const BLOG_INDEX_COPY: Record<BlogLocale, BlogIndexCopy> = {
  en: {
    eyebrow: "Journal",
    title: "Curated notes for confident shopping",
    subtitle: "Guides, care tips, and seasonal edits to refine every purchase.",
    emptyState: "New stories are being prepared. Please check back soon.",
    backLabel: "Back to Journal",
  },
  "pt-br": {
    eyebrow: "Journal",
    title: "Notas curadas para comprar com seguranca",
    subtitle: "Guias, cuidados e edits sazonais para decidir com precisao.",
    emptyState: "Novas historias estao sendo preparadas. Volte em breve.",
    backLabel: "Voltar ao Journal",
  },
  es: {
    eyebrow: "Journal",
    title: "Notas curadas para comprar con confianza",
    subtitle: "Guias, cuidado y ediciones estacionales para decidir mejor.",
    emptyState: "Nuevas historias estan en preparacion. Vuelve pronto.",
    backLabel: "Volver al Journal",
  },
};

const EN_POSTS: BlogPost[] = [
  {
    slug: "high-quality-inspection",
    locale: "en",
    title: "High-Quality Inspection: What We Check Before Shipping",
    excerpt:
      "Every piece passes a material, hardware, and finish review so your delivery feels flawless.",
    publishAt: "2025-01-08",
    coverImage:
      "https://images.unsplash.com/photo-1506617420156-8e4536971650?auto=format&fit=crop&w=1400&q=80",
    body: [
      "Before anything ships, we run a multi-step inspection focused on materials, silhouette, and finish. The goal is simple: a piece that feels refined the moment it arrives.",
      "We check leather grain consistency, edge paint, stitching tension, hardware alignment, and zipper travel. If a strap is off or a clasp feels uneven, it does not pass.",
      "Condition is documented in detail so you know what to expect. We focus on clear, practical language rather than vague labels.",
      "Only after a final review and secure packing does the item leave our hands. If anything falls short, we replace it or remove it from the edit.",
    ],
    tags: ["quality", "inspection", "care"],
  },
  {
    slug: "choose-the-right-bag-size",
    locale: "en",
    title: "How to Choose the Right Bag Size",
    excerpt:
      "A simple way to match size to your daily carry, from compact evenings to full workdays.",
    publishAt: "2025-01-12",
    coverImage:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1400&q=80",
    body: [
      "Start with your daily carry. If you bring only essentials, a compact shoulder or mini crossbody will feel effortless. For workdays, look for a medium size that fits a tablet and a small pouch.",
      "Check the measurements, not just the name. Width, height, and depth tell you how the bag sits and what it can hold.",
      "Strap drop matters. A shorter drop reads polished and structured, while a longer drop feels casual and travel-friendly.",
      "When in doubt, choose the size that leaves a little space. A bag that is slightly larger tends to feel more relaxed and less restrictive.",
    ],
    tags: ["bags", "size", "styling"],
  },
  {
    slug: "leather-care-guide",
    locale: "en",
    title: "Leather Care Guide: Keep Your Bag Looking New",
    excerpt:
      "Easy habits for long-term texture and color, from daily handling to storage.",
    publishAt: "2025-01-15",
    coverImage:
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1400&q=80",
    body: [
      "Leather stays beautiful when it is kept away from prolonged moisture, heat, and direct sunlight. If it gets wet, blot gently and let it air-dry naturally.",
      "Wipe hardware and surfaces with a soft, dry cloth after wear. A neutral conditioner used sparingly helps maintain flexibility.",
      "Store bags upright in a dust bag with light stuffing to keep their shape. Avoid tight stacking that can cause pressure marks.",
      "For deeper scuffs or color transfer, professional cleaning is the safest route. A light touch preserves texture over time.",
    ],
    tags: ["care", "leather", "maintenance"],
  },
  {
    slug: "color-edit-timeless-palette",
    locale: "en",
    title: "Color Edit: Building a Timeless Palette",
    excerpt:
      "Neutral foundations plus a confident accent keep every look refined and easy to wear.",
    publishAt: "2025-01-18",
    coverImage:
      "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1400&q=80",
    body: [
      "Begin with neutrals that work across seasons: black, warm tan, soft taupe, and ivory. These anchor outfits without demanding attention.",
      "Add one accent color that feels personal. Deep green, burgundy, or cobalt can elevate even the simplest look.",
      "Match hardware tones to your jewelry for a polished finish. Mixed metals can work, but keep one tone dominant.",
      "If this is your first luxury piece, a neutral shade offers the most versatility and longevity.",
    ],
    tags: ["color", "styling", "wardrobe"],
  },
  {
    slug: "gift-guide-under-300",
    locale: "en",
    title: "Gift Guide: Luxury Picks Under $300",
    excerpt:
      "Small leather goods and refined accessories that feel elevated without overspending.",
    publishAt: "2025-01-22",
    coverImage:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1400&q=80",
    body: [
      "Start with pieces that feel personal but practical: card holders, compact wallets, silk scarves, and subtle jewelry.",
      "Look for neutral colors and clean silhouettes that pair with different styles. This keeps the gift easy to wear or carry.",
      "Packaging matters. A carefully wrapped piece with a note instantly feels more considered.",
      "For clients, small leather goods make elegant thank-you gifts that travel well and stay memorable.",
    ],
    tags: ["gifts", "accessories", "wallets"],
  },
  {
    slug: "size-guide-shoes-rings",
    locale: "en",
    title: "Sizing Guide: Shoes and Rings (International)",
    excerpt:
      "Use simple measurements to match US, EU, and UK standards with confidence.",
    publishAt: "2025-01-26",
    coverImage:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1400&q=80",
    body: [
      "For shoes, measure foot length in centimeters and compare to the brand's size chart. When between sizes, choose the larger size for comfort.",
      "For rings, wrap a thin strip of paper around the base of the finger, mark the overlap, and measure the length. This gives your circumference in millimeters.",
      "Different regions label sizes differently. Use the conversion charts and double-check fit notes, especially for wider bands.",
      "If you are gifting, adjustable styles or half sizes provide flexibility without sacrificing elegance.",
    ],
    tags: ["sizing", "shoes", "rings"],
  },
];

const PT_POSTS: BlogPost[] = [
  {
    slug: "high-quality-inspection",
    locale: "pt-br",
    title: "Inspecao de alta qualidade: o que verificamos antes do envio",
    excerpt:
      "Cada peca passa por revisao de materiais, ferragens e acabamento para chegar impecavel.",
    publishAt: "2025-01-08",
    coverImage:
      "https://images.unsplash.com/photo-1506617420156-8e4536971650?auto=format&fit=crop&w=1400&q=80",
    body: [
      "Antes de enviar, fazemos uma inspecao em varias etapas focada em material, silhueta e acabamento. O objetivo e que a peca pareca refinada desde o primeiro contato.",
      "Avaliamos consistencia do couro, pintura de borda, tensao dos pontos, alinhamento das ferragens e o movimento dos zippers. Se algo nao estiver perfeito, a peca nao passa.",
      "O estado e documentado de forma clara para voce saber exatamente o que esperar.",
      "Apenas apos a revisao final e a embalagem segura o item sai. Se algo nao estiver no padrao, substituimos.",
    ],
    tags: ["qualidade", "inspecao", "cuidado"],
  },
  {
    slug: "choose-the-right-bag-size",
    locale: "pt-br",
    title: "Como escolher o tamanho ideal da bolsa",
    excerpt:
      "Uma forma simples de combinar tamanho e rotina, do dia a dia ao trabalho.",
    publishAt: "2025-01-12",
    coverImage:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1400&q=80",
    body: [
      "Comece pelo que voce carrega. Se sao apenas essenciais, uma bolsa compacta funciona. Para trabalho, prefira tamanho medio que comporte tablet e necessaire.",
      "Olhe as medidas reais, nao so o nome. Largura, altura e profundidade mostram como a bolsa se comporta.",
      "A altura da alca influencia o caimento. Alcas curtas trazem elegancia, alcas longas deixam mais casual.",
      "Se estiver em duvida, escolha um tamanho um pouco maior. Isso evita limitacoes no uso.",
    ],
    tags: ["bolsas", "tamanho", "estilo"],
  },
  {
    slug: "leather-care-guide",
    locale: "pt-br",
    title: "Guia de cuidado do couro: mantenha sua bolsa como nova",
    excerpt:
      "Habitos simples para preservar textura e cor no longo prazo.",
    publishAt: "2025-01-15",
    coverImage:
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1400&q=80",
    body: [
      "O couro fica melhor quando protegido de umidade, calor e sol direto. Se molhar, seque com cuidado e deixe ventilando.",
      "Limpe com pano macio e seco apos o uso. Condicionador neutro, usado com moderacao, ajuda a manter a flexibilidade.",
      "Guarde a bolsa em saco de protecao, com leve enchimento para manter a forma. Evite empilhar.",
      "Para manchas mais fortes, a limpeza profissional e a escolha mais segura.",
    ],
    tags: ["couro", "cuidado", "manutencao"],
  },
  {
    slug: "color-edit-timeless-palette",
    locale: "pt-br",
    title: "Paleta de cores: como criar um guarda-roupa atemporal",
    excerpt:
      "Neutros fortes com um toque de cor deixam tudo mais elegante.",
    publishAt: "2025-01-18",
    coverImage:
      "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1400&q=80",
    body: [
      "Comece com neutros que funcionam o ano inteiro: preto, caramelo, taupe e off-white.",
      "Adicione uma cor de destaque que tenha a sua cara. Verde escuro, vinho ou cobalto elevam o look.",
      "Combine o tom das ferragens com suas joias para um acabamento mais sofisticado.",
      "Para a primeira peca de luxo, um tom neutro costuma ser a escolha mais versatil.",
    ],
    tags: ["cores", "estilo", "guarda-roupa"],
  },
  {
    slug: "gift-guide-under-300",
    locale: "pt-br",
    title: "Guia de presentes: pecas de luxo ate US$300",
    excerpt:
      "Acessorios refinados e pequenos itens em couro com custo controlado.",
    publishAt: "2025-01-22",
    coverImage:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1400&q=80",
    body: [
      "Itens pequenos e pessoais funcionam melhor: porta-cartoes, carteiras compactas, lenos e joias discretas.",
      "Cores neutras e formas limpas facilitam a combinacao com diferentes estilos.",
      "Uma embalagem bem feita e um bilhete curto elevam a experiencia do presente.",
      "Para clientes, pequenos itens em couro sao elegantes e faceis de enviar.",
    ],
    tags: ["presentes", "acessorios", "couro"],
  },
  {
    slug: "size-guide-shoes-rings",
    locale: "pt-br",
    title: "Guia de tamanhos: sapatos e aneis (padroes internacionais)",
    excerpt:
      "Medidas simples para alinhar US, EU e UK com seguranca.",
    publishAt: "2025-01-26",
    coverImage:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1400&q=80",
    body: [
      "Para sapatos, meca o comprimento do pe em centimetros e compare com a tabela da marca. Se estiver entre tamanhos, escolha o maior.",
      "Para aneis, use uma tira de papel no dedo, marque a volta e meca em milimetros. Esse valor e a circunferencia.",
      "Padroes variam entre regioes. Use a conversao e confira as observacoes de ajuste.",
      "Para presentes, modelos ajustaveis ou meio numero ajudam a acertar.",
    ],
    tags: ["tamanhos", "sapatos", "aneis"],
  },
];

const ES_POSTS: BlogPost[] = [
  {
    slug: "high-quality-inspection",
    locale: "es",
    title: "Inspeccion de alta calidad: que revisamos antes del envio",
    excerpt:
      "Cada pieza pasa por control de materiales, herrajes y acabado antes de salir.",
    publishAt: "2025-01-08",
    coverImage:
      "https://images.unsplash.com/photo-1506617420156-8e4536971650?auto=format&fit=crop&w=1400&q=80",
    body: [
      "Antes de enviar, realizamos una inspeccion en varias etapas centrada en material, silueta y acabado. Queremos que la pieza se sienta impecable desde el primer momento.",
      "Revisamos consistencia del cuero, pintura de bordes, tension de costuras, alineacion de herrajes y el recorrido de los cierres.",
      "El estado se documenta con claridad para que sepas exactamente que esperar.",
      "Solo despues de la revision final y el embalaje seguro el articulo sale. Si no cumple, se reemplaza.",
    ],
    tags: ["calidad", "inspeccion", "cuidado"],
  },
  {
    slug: "choose-the-right-bag-size",
    locale: "es",
    title: "Como elegir el tamano ideal de bolso",
    excerpt:
      "Una forma simple de alinear el tamano con tu rutina diaria.",
    publishAt: "2025-01-12",
    coverImage:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1400&q=80",
    body: [
      "Empieza por lo que llevas a diario. Si son solo esenciales, un mini o compacto es perfecto. Para trabajo, busca un tamano medio que permita tablet y neceser.",
      "Revisa las medidas reales, no solo el nombre. Ancho, alto y profundidad definen la capacidad.",
      "La caida de la correa cambia el estilo: corta para un look pulido, larga para algo mas relajado.",
      "Si dudas, elige un tamano ligeramente mayor. Se siente mas comodo y flexible.",
    ],
    tags: ["bolsos", "tamano", "estilo"],
  },
  {
    slug: "leather-care-guide",
    locale: "es",
    title: "Guia de cuidado del cuero: manten tu bolso como nuevo",
    excerpt:
      "Habitos sencillos para conservar textura y color a largo plazo.",
    publishAt: "2025-01-15",
    coverImage:
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1400&q=80",
    body: [
      "El cuero se mantiene mejor lejos de la humedad, el calor y el sol directo. Si se moja, seca con cuidado y deja airear.",
      "Limpia con un pano suave y seco despues de usarlo. Un acondicionador neutro ayuda a mantener la flexibilidad.",
      "Guarda el bolso en bolsa de proteccion con un relleno ligero para conservar la forma. Evita apilarlo.",
      "Para manchas profundas, lo mas seguro es una limpieza profesional.",
    ],
    tags: ["cuero", "cuidado", "mantenimiento"],
  },
  {
    slug: "color-edit-timeless-palette",
    locale: "es",
    title: "Paleta de color: como crear un guardarropa atemporal",
    excerpt:
      "Neutros solidos y un acento elegante hacen todo mas versatil.",
    publishAt: "2025-01-18",
    coverImage:
      "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1400&q=80",
    body: [
      "Comienza con neutros que funcionan todo el ano: negro, camel, taupe y marfil.",
      "Agrega un acento que represente tu estilo. Verde profundo, burdeos o cobalto elevan cualquier look.",
      "Coordina los herrajes con tus joyas para un acabado mas pulido.",
      "Si es tu primera pieza, un tono neutro suele ser la opcion mas versatil.",
    ],
    tags: ["color", "estilo", "guardarropa"],
  },
  {
    slug: "gift-guide-under-300",
    locale: "es",
    title: "Guia de regalos: piezas de lujo por menos de 300 USD",
    excerpt:
      "Accesorios refinados y pequenos articulos en cuero con gran impacto.",
    publishAt: "2025-01-22",
    coverImage:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1400&q=80",
    body: [
      "Los mejores regalos son personales y utiles: tarjeteros, carteras compactas, panuelos de seda y joyeria discreta.",
      "Los colores neutros y las siluetas limpias facilitan la combinacion con cualquier estilo.",
      "Un empaque cuidado y una nota breve mejoran la experiencia.",
      "Para clientes, los pequenos articulos en cuero son elegantes y faciles de enviar.",
    ],
    tags: ["regalos", "accesorios", "cuero"],
  },
  {
    slug: "size-guide-shoes-rings",
    locale: "es",
    title: "Guia de tallas: zapatos y anillos (estandares internacionales)",
    excerpt:
      "Medidas simples para convertir entre US, EU y UK sin dudas.",
    publishAt: "2025-01-26",
    coverImage:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1400&q=80",
    body: [
      "Para zapatos, mide el largo del pie en centimetros y compara con la tabla de la marca. Si estas entre tallas, elige la mayor.",
      "Para anillos, rodea el dedo con una tira de papel, marca el cierre y mide en milimetros. Ese numero es la circunferencia.",
      "Los estandares varian por region. Usa la conversion y revisa notas de ajuste.",
      "Si es un regalo, los modelos ajustables o medias tallas ayudan a acertar.",
    ],
    tags: ["tallas", "zapatos", "anillos"],
  },
];

const BLOG_POSTS: Record<BlogLocale, BlogPost[]> = {
  en: EN_POSTS,
  "pt-br": PT_POSTS,
  es: ES_POSTS,
};

const LOCALE_LABELS: Record<BlogLocale, string> = {
  en: "en-US",
  "pt-br": "pt-BR",
  es: "es-ES",
};

const LEGACY_FASHION_BLOG_SLUGS = new Set([
  "choose-the-right-bag-size",
  "gift-guide-under-300",
  "size-guide-shoes-rings",
]);

export const getBlogIndexCopy = (locale: BlogLocale) => BLOG_INDEX_COPY[locale];

export const getBlogPosts = (locale: BlogLocale) => {
  return [...BLOG_POSTS[locale]].sort(
    (a, b) => new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime(),
  );
};

export const isLegacyFashionBlogSlug = (slug: string) => LEGACY_FASHION_BLOG_SLUGS.has(slug);

export const getIndexableBlogPosts = (locale: BlogLocale) =>
  getBlogPosts(locale).filter((post) => !isLegacyFashionBlogSlug(post.slug));

export const getBlogPost = (locale: BlogLocale, slug: string) => {
  return BLOG_POSTS[locale].find((post) => post.slug === slug) ?? null;
};

export const isBlogLocale = (value?: string): value is BlogLocale => {
  if (!value) return false;
  return BLOG_LOCALES.includes(value as BlogLocale);
};

export const formatBlogDate = (locale: BlogLocale, value: string) => {
  const formatter = new Intl.DateTimeFormat(LOCALE_LABELS[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return formatter.format(new Date(value));
};

export const getBlogPath = (locale: BlogLocale, slug?: string) => {
  const base = locale === "en" ? "/blog" : `/${locale}/blog`;
  if (!slug) return base;
  return `${base}/${slug}`;
};
