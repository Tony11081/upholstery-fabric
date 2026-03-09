type SeoFaq = {
  question: string;
  answer: string;
};

type SeoContent = {
  description: string;
  intro: string[];
  highlights: string[];
  faqs: SeoFaq[];
};

export function getCategorySeoContent(name: string, slug: string): SeoContent {
  const lowerName = name.toLowerCase();

  switch (slug) {
    case "jacquard":
      return {
        description:
          "Browse designer jacquard fabric by the yard for upholstery, cushions, statement panels, and tailored interior accents.",
        intro: [
          "Jacquard is one of the strongest commercial-intent categories on the site because buyers usually know they need woven pattern, texture, and structure before they even compare brands.",
          "This page should answer practical questions quickly: what jacquard is, whether it suits upholstery, what brands are available, and how each lot is sold by the yard.",
        ],
        highlights: [
          "Best for accent chairs, dining seats, headboards, cushions, and decorative panels.",
          "Sold by the yard, with designer patterns from maisons such as Dior, Fendi, Gucci, and Louis Vuitton.",
          "Compare weave, color, backing, and availability before ordering swatches or full yardage.",
        ],
        faqs: [
          {
            question: "Is jacquard suitable for upholstery?",
            answer:
              "Many jacquard fabrics are suitable for decorative or light-to-medium upholstery. Always check backing, weight, and weave density before using on high-wear furniture.",
          },
          {
            question: "Do you sell jacquard fabric by the yard?",
            answer:
              "Yes. Listing prices on this site are set per yard, which makes the catalog easier to compare for upholstery and interior projects.",
          },
          {
            question: "What should I compare first on a jacquard listing?",
            answer:
              "Start with pattern scale, fabric width, backing, composition, and whether the lot is better for upholstery, drapery, or decorative panels.",
          },
        ],
      };
    case "leather":
      return {
        description:
          "Browse designer leather fabric by the yard for upholstery, trim work, panels, and statement furniture projects.",
        intro: [
          "Leather buyers usually care about durability, finish, thickness, and whether the material is appropriate for furniture, wall panels, or specialty trim.",
          "This category should read like a buying guide, not just a gallery: make the composition, hand feel, and recommended applications easy to scan.",
        ],
        highlights: [
          "Best for furniture panels, accent seating, trim details, and luxury interior applications.",
          "Useful for shoppers comparing finish, thickness, backing, and statement brand patterns.",
          "Clear per-yard pricing makes leather lots easier to quote for upholsterers and designers.",
        ],
        faqs: [
          {
            question: "Is this leather sold by the yard?",
            answer:
              "Yes. Leather listings on this site are merchandised with a per-yard price so buyers can estimate upholstery usage quickly.",
          },
          {
            question: "Can leather be used for heavy-wear upholstery?",
            answer:
              "Some lots can, but suitability depends on thickness, finish, backing, and project type. Product pages should be checked for application guidance before ordering.",
          },
          {
            question: "What details matter most when comparing leather lots?",
            answer:
              "Thickness, finish, flexibility, backing, and color consistency are the key comparison points for upholstery and interior design use.",
          },
        ],
      };
    case "vinyl":
      return {
        description:
          "Explore designer vinyl upholstery fabric by the yard for high-impact furniture, trim, and interior projects that need coated surfaces.",
        intro: [
          "Vinyl and coated fabrics are often researched by use case first, especially for hospitality-style seating, easy-clean surfaces, and bold branded pattern work.",
          "These pages should present practical information clearly, because shoppers compare wipeability, weight, backing, and pattern before they compare story or mood.",
        ],
        highlights: [
          "Best for easy-clean accent seating, benches, panels, and decorative upholstery.",
          "Brand-led coated fabrics help buyers compare pattern, gloss level, backing, and upholstery suitability.",
          "Per-yard pricing keeps quoting simple for designers and workrooms.",
        ],
        faqs: [
          {
            question: "Is vinyl fabric good for upholstery?",
            answer:
              "Vinyl can work well for easy-clean upholstery applications, but buyers should still confirm backing, thickness, and intended wear level on each product page.",
          },
          {
            question: "How is vinyl different from leather?",
            answer:
              "Vinyl is a coated material with a different hand feel, care profile, and backing construction. It is often chosen for wipeable surfaces and strong graphic finishes.",
          },
          {
            question: "Do you price vinyl by the yard?",
            answer:
              "Yes. Vinyl listings on this site are priced per yard for straightforward project estimating.",
          },
        ],
      };
    default:
      return {
        description: `Browse ${lowerName} fabric by the yard for upholstery, soft furnishings, and designer interior projects.`,
        intro: [
          `${name} is a commercial landing page that should combine shopping intent with useful buying context. Search engines and AI tools both respond better when the page explains what the material is, where it is used, and how it is sold.`,
          `For this catalog, the page should make three things obvious: designer provenance, practical use cases, and per-yard pricing for fast project comparison.`,
        ],
        highlights: [
          `Compare ${lowerName} options by brand, color, texture, and inventory.`,
          "Use these listings to shortlist lots for upholstery, cushions, drapery, trims, or interior accents.",
          "Clear attributes, FAQ copy, and product links help both buyers and AI search tools understand the category.",
        ],
        faqs: [
          {
            question: `How is ${lowerName} sold on this site?`,
            answer:
              "Listings are merchandised by the yard so designers and upholstery buyers can estimate usage more easily.",
          },
          {
            question: `What should I compare before ordering ${lowerName}?`,
            answer:
              "Start with width, composition, pattern scale, backing, color, and whether the lot is suitable for upholstery or decorative use.",
          },
          {
            question: "Can I use these listings for upholstery planning?",
            answer:
              "Yes, but the exact suitability depends on each product's structure, backing, and wear requirements. Product pages should state the most relevant details.",
          },
        ],
      };
  }
}

export function getBrandSeoContent(name: string, description?: string | null): SeoContent {
  const lowerName = name.toLowerCase();
  const baseDescription =
    description?.trim() ||
    `Browse ${name} fabric by the yard, including designer jacquards, coated textiles, upholstery-weight materials, and statement interior lots.`;

  return {
    description: baseDescription,
    intro: [
      `${name} should work as an entity hub, not just a brand label. Buyers who land here are usually searching for a specific maison pattern, upholstery texture, or archive-inspired textile by the yard.`,
      `To perform well in both search and AI answers, this page should clearly connect ${name} with fabric types, common interior uses, and the exact products available now.`,
    ],
    highlights: [
      `Browse ${lowerName} fabrics by the yard across jacquard, vinyl, leather, and upholstery-focused lots where available.`,
      `Use the brand page to compare pattern families, material types, and in-stock options without leaving the ${name} entity context.`,
      "Strong brand pages improve both organic discovery and AI citation because they act like authoritative hubs.",
    ],
    faqs: [
      {
        question: `What kinds of ${name} fabrics are available?`,
        answer:
          "Availability changes over time, but brand pages should surface the active lots, material types, and the most relevant use cases for each listing.",
      },
      {
        question: `Is ${name} fabric sold by the yard?`,
        answer:
          "Yes. Products on this site are priced by the yard so designers and upholstery buyers can quote projects more easily.",
      },
      {
        question: `Why use a brand page instead of searching product by product?`,
        answer:
          `A dedicated ${name} page gives search engines, AI tools, and human buyers a cleaner entity signal and a faster way to compare related lots.`,
      },
    ],
  };
}
