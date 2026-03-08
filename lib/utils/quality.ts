export type QualityImage = {
  url: string;
  alt?: string;
  label?: string | null;
  isCover?: boolean;
};

type QualityInput = {
  title?: string;
  description?: string;
  images: QualityImage[];
};

export type QualityScore = {
  score: number;
  notes: string[];
};

export function scoreProductQuality(input: QualityInput): QualityScore {
  let score = 0;
  const notes: string[] = [];

  // Title score (max 30)
  if (input.title) {
    score += Math.min(30, input.title.length > 10 ? 30 : input.title.length * 3);
    if (input.title.length < 8) {
      notes.push("Title is short");
    }
  } else {
    notes.push("Add a product title");
  }

  // Description score (max 30)
  if (input.description) {
    score += Math.min(30, input.description.length > 50 ? 30 : Math.floor(input.description.length * 0.6));
    if (input.description.length < 50) {
      notes.push("Description could be longer");
    }
  } else {
    notes.push("Add a product description");
  }

  // Images score (max 40)
  const imageCount = input.images.length;
  score += Math.min(40, imageCount * 10);
  if (imageCount === 0) {
    notes.push("Add product images");
  } else if (imageCount < 3) {
    notes.push("Add more product images");
  }

  return { score: Math.min(100, score), notes };
}
