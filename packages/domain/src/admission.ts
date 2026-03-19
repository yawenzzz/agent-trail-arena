export type AdmissionStatus =
  | "production-ready"
  | "limited-scope-trial"
  | "needs-tuning-and-retest"
  | "not-allowed-for-production";

export interface AdmissionResult {
  readonly status: AdmissionStatus;
  readonly explanation: string;
}
