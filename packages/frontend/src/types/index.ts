export type { User } from "./database";

// Validation types
export interface ValidationError {
  field: string;
  message: string;
}
