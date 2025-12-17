// src/types.ts

export enum Role {
  MANAGEMENT = 'Gerencia (Marc)',
  CLEANING = 'Limpieza',
  RECEPTION = 'Recepción',
  MAINTENANCE = 'Mantenimiento'
}

export enum Urgency {
  LOW = 'Baja',
  MEDIUM = 'Media',
  HIGH = 'Alta'
}

export enum Impact {
  NONE = 'No afecta',
  ANNOYING = 'Molesta',
  BLOCKING = 'Impide uso'
}

export enum TicketStatus {
  OPEN = 'Reportado',
  IN_PROGRESS = 'En proceso',
  WAITING_PART = 'Espera Refacción',
  VENDOR = 'Requiere Proveedor',
  RESOLVED = 'Resuelto',
  VERIFIED = 'Verificado'
}

export interface AuditEvent {
  date: string; // ISO string
  action: string;
  user: Role | string;
}

// =========================
// Inventario / Refacciones
// =========================

export type PartCategory =
  | 'Eléctrico'
  | 'Plomería'
  | 'HVAC'
  | 'Cerrajería'
  | 'Mobiliario'
  | 'TV/WiFi'
  | 'Consumibles'
  | 'Otros';

export interface InventoryPart {
  id: string; // ej. P-001
  name: string; // nombre visible
  category: PartCategory;
  unit: 'pza' | 'kit' | 'm' | 'lt' | 'otro';

  // Stock
  stockOnHand: number; // disponible físico
  stockReserved: number; // reservado por tickets
  minStock: number; // umbral mínimo

  // Metadatos DEMO (no implica integración)
  preferredVendor?: string;
  leadTimeDays?: number;
  location?: string; // anaquel / cuarto / bodega
  sku?: string;
}

export type PartMovementType =
  | 'RESERVE' // reservar para ticket
  | 'RELEASE' // liberar reserva (cierre/cambio)
  | 'ISSUE' // salida a mantenimiento (consumo)
  | 'RECEIVE' // entrada por compra
  | 'ADJUST' // ajuste manual (demo)
  | 'PO_CREATED' // se generó OC
  | 'PO_SENT' // enviada
  | 'PO_RECEIVED'; // recibida

export interface PartMovement {
  id: string; // ej. M-0001
  partId: string;
  type: PartMovementType;
  qty: number; // siempre positivo; el tipo define si suma/resta
  date: string; // ISO
  user: Role | string;
  note?: string;
  ticketId?: string;
  poId?: string;
}

export enum POStatus {
  DRAFT = 'Borrador',
  ORDERED = 'Pedido',
  RECEIVED = 'Recibido',
  CANCELED = 'Cancelado'
}

export interface PurchaseOrderItem {
  partId: string;
  partName: string;
  qty: number;
  unit?: string;
}

export interface PurchaseOrder {
  id: string; // ej. OC-0001
  status: POStatus;
  createdAt: string; // ISO
  createdBy: Role | string;
  vendor: string;
  etaDate?: string; // ISO (DEMO)
  items: PurchaseOrderItem[];
  notes?: string;
}

// =========================
// Tickets / Operación
// =========================

export interface Ticket {
  id: string;
  roomNumber: string;
  isOccupied: boolean;
  asset: string;
  issueType: string;
  description: string;
  urgency: Urgency;
  impact: Impact;
  status: TicketStatus;
  createdAt: string; // ISO string
  createdBy: Role;
  assignedTo?: string; // Name of technician
  notes: string[];
  history: AuditEvent[];

  // Decision support fields
  needsPart?: boolean;

  // Inventario: vínculo real (evita prompts)
  partId?: string; // referencia a InventoryPart.id
  partName?: string; // redundante para UI/CSV (DEMO)
  partQty?: number; // cantidad solicitada/reservada

  needsVendor?: boolean;
  vendorType?: string;

  // Compra (DEMO)
  poId?: string; // si se generó OC ligada

  verifiedBy?: string;
  closedAt?: string;

  // Calculated
  priorityScore: number;
}

export interface Room {
  number: string;
  floor: number;
  type: 'Suite' | 'Standard' | 'Deluxe';
}
