import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  CapabilityImprovementStore,
  CapabilityImprovementStoreState
} from "./capability-store.js";
import { createInMemoryCapabilityImprovementStore } from "./capability-store.js";

export interface CreateFileBackedCapabilityImprovementStoreInput {
  readonly stateFilePath: string;
}

function readStateFile(
  stateFilePath: string
): CapabilityImprovementStoreState | undefined {
  try {
    const content = readFileSync(stateFilePath, "utf8");
    return JSON.parse(content) as CapabilityImprovementStoreState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

export function createFileBackedCapabilityImprovementStoreSync(
  input: CreateFileBackedCapabilityImprovementStoreInput
): CapabilityImprovementStore {
  mkdirSync(dirname(input.stateFilePath), { recursive: true });
  const initialState = readStateFile(input.stateFilePath);
  const store = createInMemoryCapabilityImprovementStore(initialState);

  function persist() {
    writeFileSync(
      input.stateFilePath,
      JSON.stringify(store.exportState(), null, 2),
      "utf8"
    );
  }

  if (!initialState) {
    persist();
  }

  return {
    ...store,
    initializeServingBundle(inputValue) {
      const result = store.initializeServingBundle(inputValue);
      persist();
      return result;
    },
    createCandidate(inputValue) {
      const result = store.createCandidate(inputValue);
      persist();
      return result;
    },
    promoteCandidate(inputValue) {
      const result = store.promoteCandidate(inputValue);
      persist();
      return result;
    },
    rollbackActiveBundle(inputValue) {
      const result = store.rollbackActiveBundle(inputValue);
      persist();
      return result;
    },
    ingestProductionTrace(inputValue) {
      const result = store.ingestProductionTrace(inputValue);
      persist();
      return result;
    },
    synthesizeEvalArtifactsFromLearningRecord(inputValue) {
      const result = store.synthesizeEvalArtifactsFromLearningRecord(inputValue);
      persist();
      return result;
    },
    generateCandidateFromLearningRecord(inputValue) {
      const result = store.generateCandidateFromLearningRecord(inputValue);
      persist();
      return result;
    },
    validateCandidate(inputValue) {
      const result = store.validateCandidate(inputValue);
      persist();
      return result;
    },
    recordMetricSnapshot(inputValue) {
      const result = store.recordMetricSnapshot(inputValue);
      persist();
      return result;
    },
    evaluateRollbackGuardrails(inputValue) {
      const result = store.evaluateRollbackGuardrails(inputValue);
      persist();
      return result;
    }
  };
}

export async function createFileBackedCapabilityImprovementStore(
  input: CreateFileBackedCapabilityImprovementStoreInput
): Promise<CapabilityImprovementStore> {
  return createFileBackedCapabilityImprovementStoreSync(input);
}
