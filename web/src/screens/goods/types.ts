// Client-side shapes for the /api/sc setup endpoints (server: server/src/sc/setup.ts).
export interface PartyRef { k: 'b' | 'c'; id: string }
export interface Contact { id: string; name: string; name_forms?: Record<string, string>; phones: string[]; language: string | null; role_hint: string | null; link_state: string }
export interface Party { ref: PartyRef; name: string; kind: 'contact' | 'business'; sub: string | null; onClaire: boolean; recent?: boolean; language?: string }
export interface Place { id: string; name: string; kind: string }
export interface AttrDef { key: string; role: 'spec' | 'lot' | 'info'; type: 'text' | 'number' | 'enum'; enum?: string[]; required?: boolean }
export interface MaterialType { id: string; key: string; base_dimension: 'mass' | 'count' | 'length'; allowed_units: string[]; material_class_key: string; attributes: AttrDef[]; labels: Record<string, string> }
export interface Spec { id: string; material_type_id: string; attrs: Record<string, string | number>; label_en: string; family_key: string }
export interface ResolvedSpec { spec: Spec; dimension: 'mass' | 'count' | 'length'; units: string[]; class: string }
