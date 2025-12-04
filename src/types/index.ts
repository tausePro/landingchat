/**
 * Central export point for all shared types
 * Import types from this file to ensure consistent usage across the codebase
 *
 * @example
 * import { ActionResult, PaginatedResult, ProductData } from "@/types"
 */

// Common types for actions and pagination
export {
  type ActionResult,
  type PaginationParams,
  type PaginatedResult,
  success,
  failure,
} from "./common"

// Product domain types
export {
  createProductSchema,
  updateProductSchema,
  subscriptionConfigSchema,
  configOptionSchema,
  variantSchema,
  optionSchema,
  type CreateProductInput,
  type UpdateProductInput,
  type SubscriptionConfig,
  type ConfigOption,
  type ProductVariant,
  type ProductOption,
  type ProductData,
} from "./product"

// Customer domain types
export {
  createCustomerSchema,
  updateCustomerSchema,
  customerAddressSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type CustomerAddress,
  type Customer,
  type GetCustomersParams,
} from "./customer"

// Order domain types
export {
  createOrderSchema,
  updateOrderSchema,
  orderStatusSchema,
  orderItemSchema,
  orderCustomerSchema,
  type CreateOrderInput,
  type UpdateOrderInput,
  type OrderStatus,
  type OrderItem,
  type OrderCustomer,
  type Order,
  type GetOrdersParams,
} from "./order"

// Organization domain types
export {
  organizationDetailsSchema,
  agentDataSchema,
  updateOrganizationSchema,
  type OrganizationDetailsInput,
  type AgentDataInput,
  type UpdateOrganizationInput,
  type Organization,
  type OrganizationSettings,
} from "./organization"

// Plan domain types
export {
  PlanSchema,
  CreatePlanInputSchema,
  UpdatePlanInputSchema,
  CurrencyEnum,
  BillingPeriodEnum,
  PlanFeaturesSchema,
  serializePlanForDb,
  deserializePlanFromDb,
  type Plan,
  type CreatePlanInput,
  type UpdatePlanInput,
  type Currency,
  type BillingPeriod,
  type PlanFeatures,
} from "./plan"

// Subscription domain types
export {
  SubscriptionSchema,
  SubscriptionWithOrgSchema,
  CreateSubscriptionInputSchema,
  UpdateSubscriptionInputSchema,
  PaymentTransactionSchema,
  CreatePaymentTransactionInputSchema,
  SubscriptionMetricsSchema,
  SubscriptionFiltersSchema,
  SubscriptionStatusEnum,
  PaymentStatusEnum,
  validatePeriodDates,
  calculateUsagePercentage,
  checkResourceLimit,
  shouldShowUsageAlert,
  type Subscription,
  type SubscriptionWithOrg,
  type CreateSubscriptionInput,
  type UpdateSubscriptionInput,
  type PaymentTransaction,
  type CreatePaymentTransactionInput,
  type SubscriptionMetrics,
  type SubscriptionFilters,
  type SubscriptionStatus,
  type PaymentStatus,
} from "./subscription"

// Payment gateway domain types
export {
  PaymentProviderSchema,
  TransactionStatusSchema,
  PaymentStatusSchema as StorePaymentStatusSchema,
  PaymentMethodSchema,
  PaymentGatewayConfigSchema,
  PaymentGatewayConfigInputSchema,
  StoreTransactionSchema,
  CreateTransactionInputSchema,
  deserializePaymentGatewayConfig,
  deserializeStoreTransaction,
  type PaymentProvider,
  type TransactionStatus,
  type PaymentStatus as StorePaymentStatus,
  type PaymentMethod,
  type PaymentGatewayConfig,
  type PaymentGatewayConfigInput,
  type StoreTransaction,
  type CreateTransactionInput,
  type TransactionResult,
  type Bank,
} from "./payment"
