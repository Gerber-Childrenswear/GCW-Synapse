export function parseAllowedTopics(raw: string): Set<string> {
  return new Set(raw.split(",").map((topic) => topic.trim()).filter((topic) => topic.length > 0));
}

export function isTopicAccepted(topic: string, expectedTopic: string, allowedTopics: Set<string>): boolean {
  if (!allowedTopics.has(topic)) {
    return false;
  }

  return topic === expectedTopic;
}
