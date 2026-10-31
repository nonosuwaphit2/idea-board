export type Idea = {
  id: string;
  title: string;
  description: string;
  author_nickname: string;
  created_at: string;
  vote_count: number;
};
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
