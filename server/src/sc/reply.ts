// A route's outcome as a value, so the same write runs from a form (HTTP) or from Claire's saved draft.
export interface Reply { status: number; body: any }
export const reply = (status: number, body: any): Reply => ({ status, body });
