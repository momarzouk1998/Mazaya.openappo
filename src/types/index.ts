export type UserRole = 'admin' | 'branch';

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  branch_id: string | null;
  avatar_url: string;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  payment_type: 'نقدي' | 'تحويل' | 'كلاهما';
  phone: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface MaterialType {
  id: string;
  name: string;
}

export interface AccessoryType {
  id: string;
  name: string;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  phone: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  branch_id: string | null;
  phone: string;
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
  branch?: Branch;
}

export interface BoardsInventory {
  id: string;
  item_name: string;
  material_type: string;
  code: string;
  supplier_id: string | null;
  unit_price: number;
  quantity_in: number;
  total_price: number;
  date_added: string;
  linked_order_id: string | null;
  quantity_used: number;
  quantity_remaining: number;
  notes: string;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
}

export interface AccessoriesInventory {
  id: string;
  item_name: string;
  accessory_type: string;
  code: string;
  supplier_id: string | null;
  unit_price: number;
  quantity_in: number;
  total_price: number;
  date_added: string;
  linked_order_id: string | null;
  quantity_used: number;
  quantity_remaining: number;
  notes: string;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
}

export type OrderStatus = 'مفتوح' | 'قيد التنفيذ' | 'مكتمل' | 'تم التسليم';
export type OrderType = 'تصنيع جديد' | 'صيانة';

export interface Order {
  id: string;
  order_name: string;
  customer_id: string | null;
  branch_id: string | null;
  order_type: OrderType;
  parent_order_id: string | null;
  start_date: string;
  end_date: string | null;
  duration_days: number | null;
  status: OrderStatus;
  boards_cost: number;
  accessories_cost: number;
  installation_cost: number;
  internal_transport_cost: number;
  external_transport_cost: number;
  factory_commission: number;
  order_total: number;
  notes: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  branch?: Branch;
  materials?: OrderMaterial[];
}

export interface OrderMaterial {
  id: string;
  order_id: string;
  item_category: 'board' | 'accessory';
  item_id: string;
  quantity_used: number;
  unit_price_snapshot: number;
  line_total: number;
  created_at: string;
  item_name?: string;
  code?: string;
  supplier_name?: string;
}

export interface Contractor {
  id: string;
  name: string;
  type: 'ألوميتال' | 'تنجيد' | 'أخرى';
  phone: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface OrderExternalWork {
  id: string;
  order_id: string;
  work_type: 'ألوميتال' | 'تنجيد' | 'أخرى';
  contractor_id: string | null;
  amount: number;
  notes: string;
  created_at: string;
  contractor?: Contractor;
}

export type JournalEntryType =
  | 'مشتريات'
  | 'دفعة واردة من معرض'
  | 'دفعة صادرة لمورد'
  | 'تحويل تمريري'
  | 'نثريات';

export type PaymentMethod = 'نقدي' | 'تحويل';

export interface JournalEntry {
  id: string;
  date: string;
  entry_type: JournalEntryType;
  description: string;
  amount: number;
  payment_method: PaymentMethod;
  party_id: string | null;
  party_type: 'supplier' | 'branch' | 'contractor' | null;
  order_id: string | null;
  is_pass_through: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface OverheadExpense {
  id: string;
  date: string;
  description: string;
  amount: number;
  notes: string;
  journal_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface SearchParams extends PaginationParams {
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  supplierId?: string;
  materialType?: string;
  branchId?: string;
  status?: string;
  entryType?: string;
}
