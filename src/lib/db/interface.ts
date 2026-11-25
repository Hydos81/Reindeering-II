import type {
  BulkTicketResult,
  Category,
  CategoryWithItems,
  MenuItem,
  Order,
  OrderStatus,
  PlaceOrderInput,
  PlaceOrderResult,
  ReserveResult,
  Stats,
  Ticket,
  TicketInput,
  TicketListParams,
  TicketListResult,
} from "../types";

// Both storage backends implement exactly this contract. Route handlers and
// UI code never import a concrete repository directly.
export type Repo = {
  listTickets(params: TicketListParams): Promise<TicketListResult>;
  getTicketById(id: string): Promise<Ticket | null>;
  getTicketsByCodes(codes: string[]): Promise<Ticket[]>;
  createTicket(input: TicketInput): Promise<Ticket>;
  updateTicket(id: string, input: TicketInput): Promise<Ticket | null>;
  deleteTicket(id: string): Promise<boolean>;
  bulkUpsertTickets(rows: TicketInput[]): Promise<BulkTicketResult>;
  setTicketCheckIn(id: string, checkedIn: boolean): Promise<Ticket | null>;
  resetTicketOrder(id: string): Promise<{ orderId: string | null; orderDeleted: boolean }>;

  listCategoriesWithItems(includeUnavailable: boolean): Promise<CategoryWithItems[]>;
  createCategory(input: { name: string; sortOrder?: number }): Promise<Category>;
  updateCategory(id: string, input: { name: string; sortOrder?: number }): Promise<Category | null>;
  deleteCategory(id: string): Promise<boolean>;
  createMenuItem(input: {
    categoryId: string;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    isAvailable?: boolean;
    sortOrder?: number;
  }): Promise<MenuItem>;
  updateMenuItem(
    id: string,
    input: {
      categoryId?: string;
      name?: string;
      description?: string | null;
      imageUrl?: string | null;
      isAvailable?: boolean;
      sortOrder?: number;
    },
  ): Promise<MenuItem | null>;
  deleteMenuItem(id: string): Promise<boolean>;

  reserveTickets(codes: string[], token: string, ttlMinutes: number): Promise<ReserveResult>;
  getReservation(token: string, ttlMinutes: number): Promise<Ticket[]>;
  releaseReservation(token: string): Promise<void>;
  placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult>;

  listOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  getOrderByGuestToken(token: string): Promise<Order | null>;
  updateOrderStatus(id: string, status: OrderStatus): Promise<Order | null>;
  setOrderZaloMessageId(id: string, messageId: string | null): Promise<void>;

  getStats(): Promise<Stats>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
};
