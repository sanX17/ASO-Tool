const POSITIVE_WORDS = [
  "good",
  "great",
  "excellent",
  "helpful",
  "amazing",
  "fast",
  "smooth",
  "reliable",
  "love",
  "best",
  "nice",
  "easy",
  "awesome",
  "satisfied"
];

const NEGATIVE_WORDS = [
  "bad",
  "worst",
  "useless",
  "slow",
  "poor",
  "issue",
  "problem",
  "crash",
  "crashes",
  "error",
  "late",
  "terrible",
  "waste",
  "disappointed",
  "doesn't",
  "not working"
];

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function scoreTextSentiment(review) {
  const lowerReview = review.toLowerCase();
  let score = 0;

  POSITIVE_WORDS.forEach((word) => {
    if (lowerReview.includes(word)) {
      score += 1;
    }
  });

  NEGATIVE_WORDS.forEach((word) => {
    if (lowerReview.includes(word)) {
      score -= 1;
    }
  });

  return score;
}

function classifySentiment(rating, review) {
  let score = 0;

  if (rating >= 4.5) {
    score += 2;
  } else if (rating >= 4) {
    score += 1;
  } else if (rating <= 2) {
    score -= 2;
  } else if (rating <= 3) {
    score -= 1;
  }

  score += scoreTextSentiment(review);

  if (score >= 2) {
    return {
      sentiment: "positive",
      confidence: "high"
    };
  }

  if (score <= -2) {
    return {
      sentiment: "negative",
      confidence: "high"
    };
  }

  return {
    sentiment: "medium",
    confidence: "medium"
  };
}

function buildReply({ name, review, sentiment }) {
  const firstName = normalizeText(name).split(" ")[0] || "there";

  if (sentiment === "positive") {
    return `Hi ${firstName}, thank you for the wonderful feedback. We're happy you had a good experience, and we appreciate you taking the time to share it.`;
  }

  if (sentiment === "negative") {
    return `Hi ${firstName}, we're sorry to hear about your experience. Thank you for sharing this feedback. Please contact our support team so we can understand the issue and help you better.`;
  }

  if (!review) {
    return `Hi ${firstName}, thank you for your rating. We appreciate your support and would love to hear more about your experience so we can keep improving.`;
  }

  return `Hi ${firstName}, thank you for your feedback. We appreciate you sharing your experience with us and will use it to keep improving our service.`;
}

const DEFAULT_TEMPLATES = {
  positive:
    "Hi {firstName}, thank you for your wonderful feedback and for giving us a {rating}-star rating. We are delighted to know you had a great experience.",
  medium:
    "Hi {firstName}, thank you for your feedback and your {rating}-star rating. We appreciate you sharing your experience and will keep working to improve.",
  negative:
    "Hi {firstName}, we're sorry your experience did not meet expectations. Thank you for sharing your feedback. Please reach out to our support team so we can help further."
};

function fillTemplate(template, values) {
  return template.replace(/\{(name|firstName|rating|review)\}/g, (_, token) => {
    return String(values[token] ?? "");
  });
}

export function generateReplyFromTemplate(row, templates = DEFAULT_TEMPLATES) {
  const firstName = normalizeText(row.name).split(" ")[0] || "there";
  const template = templates[row.sentiment] || DEFAULT_TEMPLATES[row.sentiment];

  return fillTemplate(template, {
    name: row.name || "Customer",
    firstName,
    rating: row.rating ?? "",
    review: row.review || ""
  });
}

function mapHeaderIndex(headerRow) {
  const normalizedHeaders = headerRow.map((header) => normalizeText(header).toLowerCase());

  return {
    name: normalizedHeaders.findIndex((header) => header === "user name" || header === "name"),
    review: normalizedHeaders.findIndex(
      (header) => header === "content" || header === "review" || header === "reviews"
    ),
    rating: normalizedHeaders.findIndex(
      (header) => header === "score" || header === "rating" || header === "ratings"
    )
  };
}

export function analyzeReviewRows(rawRows) {
  if (!rawRows.length) {
    return {
      rows: [],
      summary: { total: 0, positive: 0, medium: 0, negative: 0 }
    };
  }

  const headerMap = mapHeaderIndex(rawRows[0]);
  const fallbackMap = {
    name: headerMap.name >= 0 ? headerMap.name : 0,
    review: headerMap.review >= 0 ? headerMap.review : 2,
    rating: headerMap.rating >= 0 ? headerMap.rating : 3
  };

  const rows = rawRows
    .slice(1)
    .map((row) => {
      const name = normalizeText(row[fallbackMap.name]);
      const review = normalizeText(row[fallbackMap.review]);
      const ratingValue = Number(row[fallbackMap.rating]);
      const rating = Number.isFinite(ratingValue) ? ratingValue : 0;

      if (!name && !review && !rating) {
        return null;
      }

      const { sentiment, confidence } = classifySentiment(rating, review);

      return {
        name: name || "Anonymous",
        review,
        rating,
        sentiment,
        confidence,
        reply: buildReply({ name, review, sentiment }),
        status: "Pending"
      };
    })
    .filter(Boolean);

  const summary = rows.reduce(
    (accumulator, row) => {
      accumulator.total += 1;
      accumulator[row.sentiment] += 1;
      return accumulator;
    },
    { total: 0, positive: 0, medium: 0, negative: 0 }
  );

  return { rows, summary };
}

export { DEFAULT_TEMPLATES };
