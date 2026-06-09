/**
 * Interest categories with descriptive text for vector similarity search.
 * Used when a user filters by interest (e.g., "Sports", "Music") to find
 * semantically related clubs and events.
 */
export const INTEREST_DESCRIPTIONS: Record<string, string> = {
  Sports:
    "athletics sports teams fitness exercise games competition soccer basketball football volleyball tennis running swimming",
  Music:
    "music bands concerts performing arts instruments singing guitar piano drums orchestra choir jazz rock pop",
  Engineering:
    "engineering robotics mechanical electrical civil aerospace technology innovation projects hackathons",
  "CS & AI":
    "computer science artificial intelligence programming coding software machine learning data science tech",
  "Art & Design": "art design visual arts painting drawing graphic design illustration creative",
  Dance: "dance ballet hip hop contemporary salsa ballroom choreography performance",
  "Theater & Comedy": "theater drama comedy improv acting plays musicals stand-up performance",
  "Film & Media": "film media video production cinema photography documentary filmmaking",
  Cultural: "cultural diversity international heritage language culture community traditions",
  Service: "community service volunteering philanthropy outreach charity nonprofit",
  "Pre-Health": "pre-med pre-health medicine nursing healthcare biology chemistry medical",
  "Pre-Law & Policy": "law policy pre-law debate government politics legal advocacy",
  Business: "business entrepreneurship finance consulting networking startups",
  Science: "science research biology chemistry physics lab STEM",
  Outdoors: "outdoors hiking camping nature adventure outdoor recreation",
  Gaming: "gaming video games esports board games tabletop",
  Faith: "faith religion spiritual community worship",
  Activism: "activism advocacy social justice environmental sustainability",
  Food: "food cooking culinary baking dining",
  Wellness: "wellness mental health mindfulness yoga meditation fitness",
};

export function getInterestSearchText(interest: string): string {
  const normalized = interest.trim();
  return INTEREST_DESCRIPTIONS[normalized] ?? normalized;
}
