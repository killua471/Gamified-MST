import defaultConfig from '@/configs/default.json';
import simpleConfig from '@/configs/simple.json';

export type QuestionType = 'rating' | 'single-select' | 'multi-select';

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  options?: string[];
  noneOption?: string;
}

export interface ClientConfig {
  clientName: string;
  questions: Question[];
}

const configs: Record<string, ClientConfig> = {
  default: defaultConfig as ClientConfig,
  simple: simpleConfig as ClientConfig,
};

export function getClientConfig(overrideId?: string | null): ClientConfig {
  const clientId = overrideId || process.env.NEXT_PUBLIC_CLIENT_ID || 'default';
  return configs[clientId] || configs.default;
}
