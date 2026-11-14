import defaultConfig from '@/configs/default.json';
import simpleConfig from '@/configs/simple.json';

export type QuestionType = 'rating' | 'single-select' | 'multi-select';

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  // For rating type
  min?: number;
  max?: number;
  placeholder?: string;
  // For select types
  options?: string[];
  // For multi-select: which option acts as "None of the Above"
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

export function getClientConfig(): ClientConfig {
  const clientId = process.env.NEXT_PUBLIC_CLIENT_ID || 'default';
  return configs[clientId] || configs.default;
}
