import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import {
  DEFAULT_CATEGORIZATION_ENGINE,
  getCategorizationEngineLabel,
} from '@/features/categorization/constants';
import { buildLlmSystemPrompt } from '@/features/categorization/prompt';
import { hydrateRuleEngineSettings } from '@/features/categorization/ruleEngine';

function resolveStoredEngine(userData = {}) {
  if (userData.categorizationEngine) {
    return userData.categorizationEngine;
  }

  if (userData.llmApiKey) {
    return 'llm';
  }

  return DEFAULT_CATEGORIZATION_ENGINE;
}

export async function loadCategorizationSettings(currentUser, categories = []) {
  if (!currentUser) {
    return {
      enabled: false,
      engine: DEFAULT_CATEGORIZATION_ENGINE,
      apiKey: '',
      systemPrompt: buildLlmSystemPrompt(categories),
      ruleEngineSettings: hydrateRuleEngineSettings(),
    };
  }

  const userDocRef = doc(db, 'users', currentUser.uid);
  const userDocSnap = await getDoc(userDocRef);
  const userData = userDocSnap.exists() ? userDocSnap.data() : {};
  const engine = resolveStoredEngine(userData);

  return {
    enabled: Boolean(userData.smartCategorizationEnabled),
    engine,
    apiKey: userData.llmApiKey || '',
    systemPrompt: userData.categorizationSystemPrompt || buildLlmSystemPrompt(categories),
    ruleEngineSettings: hydrateRuleEngineSettings(userData.ruleEngineSettings),
  };
}

export async function saveCategorizationSettings(currentUser, nextSettings) {
  if (!currentUser) {
    return;
  }

  const userDocRef = doc(db, 'users', currentUser.uid);
  await setDoc(
    userDocRef,
    {
      ...nextSettings,
      updatedAt: new Date(),
    },
    { merge: true }
  );
}

export async function verifyLlmApiKey(apiKey) {
  const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      messages: [
        {
          content: 'hello world',
          role: 'user',
        },
      ],
      model: 'doubao-seed-1-6-flash-250615',
    }),
  });

  if (!response.ok) {
    let message = response.statusText;

    try {
      const payload = await response.json();
      message = payload.message || payload.error?.message || message;
    } catch {
      // Ignore JSON parse failures for non-JSON responses.
    }

    throw new Error(message || 'API key verification failed');
  }

  return true;
}

export function getCategorizationStatusMessage(engineId, ruleEngineSettings) {
  if (engineId === 'rules') {
    const configName = ruleEngineSettings?.billConfigs?.find(
      (config) => config.id === ruleEngineSettings?.selectedBillConfigId
    )?.name;

    return configName
      ? `Automatic categorization is enabled with ${getCategorizationEngineLabel(engineId)} using ${configName}.`
      : `Automatic categorization is enabled with ${getCategorizationEngineLabel(engineId)}.`;
  }

  return `Automatic categorization is enabled with ${getCategorizationEngineLabel(engineId)}.`;
}
