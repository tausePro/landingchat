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
  bundleItemSchema,
  type CreateProductInput,
  type UpdateProductInput,
  type SubscriptionConfig,
  type ConfigOption,
  type ProductVariant,
  type ProductOption,
  type BundleItem,
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
  type OrganizationTrackingConfig,
  type OrganizationSettingsOverrides,
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
  ManualPaymentMethodsSchema,
  ManualPaymentMethodsInputSchema,
  deserializePaymentGatewayConfig,
  deserializeStoreTransaction,
  deserializeManualPaymentMethods,
  type PaymentProvider,
  type TransactionStatus,
  type PaymentStatus as StorePaymentStatus,
  type PaymentMethod,
  type PaymentGatewayConfig,
  type PaymentGatewayConfigInput,
  type StoreTransaction,
  type CreateTransactionInput,
  type ManualPaymentMethods,
  type ManualPaymentMethodsInput,
  type TransactionResult,
  type Bank,
} from "./payment"

// WhatsApp integration domain types
export {
  WhatsAppInstanceTypeSchema,
  WhatsAppInstanceStatusSchema,
  WhatsAppProviderSchema,
  WhatsAppInstanceSchema,
  CreateWhatsAppInstanceInputSchema,
  UpdateWhatsAppInstanceInputSchema,
  EvolutionWebhookEventSchema,
  EvolutionWebhookSchema,
  WhatsAppMessageTypeSchema,
  WhatsAppMessageSchema,
  EvolutionConfigSchema,
  ChannelTypeSchema,
  deserializeWhatsAppInstance,
  formatPhoneDisplay,
  hashPhoneNumber,
  type WhatsAppInstanceType,
  type WhatsAppInstanceStatus,
  type WhatsAppProvider,
  type WhatsAppInstance,
  type CreateWhatsAppInstanceInput,
  type UpdateWhatsAppInstanceInput,
  type EvolutionWebhookEvent,
  type EvolutionWebhook,
  type WhatsAppMessageType,
  type WhatsAppMessage,
  type EvolutionConfig,
  type EvolutionInstance,
  type EvolutionConnectionStatus,
  type EvolutionSendMessageResponse,
  type ChannelType,
} from "./whatsapp"

// Landing Page configuration types
export {
  defaultLandingConfig,
  type LandingMainConfig,
  type LandingNavLink,
  type LandingMetric,
  type LandingTrustBadge,
  type LandingFeature,
  type LandingTestimonial,
  type LandingMarketplaceAgent,
  type LandingComparisonRow,
  type LandingFooterColumn,
} from "./landing"

// Founding Members / Early Adopters domain types
export {
  FoundingSlotStatusEnum,
  FoundingActivityTypeEnum,
  FoundingProgramSchema,
  FoundingTierSchema,
  FoundingTierWithStatsSchema,
  FoundingSlotSchema,
  FoundingSlotWithRelationsSchema,
  FoundingActivitySchema,
  FoundingPriceHistorySchema,
  UpdateFoundingProgramInputSchema,
  CreateFoundingTierInputSchema,
  UpdateFoundingTierInputSchema,
  ReserveFoundingSlotInputSchema,
  calculateCurrentPrice,
  calculateAnnualPrice,
  formatFoundingPrice,
  anonymizeNameForFeed,
  type FoundingSlotStatus,
  type FoundingActivityType,
  type FoundingProgram,
  type FoundingTier,
  type FoundingTierWithStats,
  type FoundingSlot,
  type FoundingSlotWithRelations,
  type FoundingActivity,
  type FoundingPriceHistory,
  type UpdateFoundingProgramInput,
  type CreateFoundingTierInput,
  type UpdateFoundingTierInput,
  type ReserveFoundingSlotInput,
  type FoundingLandingData,
  type FoundingLandingConfig,
  type FoundingMetrics,
} from "./founding"

// Industry Templates & Modules domain types
export {
  IndustrySlugEnum,
  ModuleSlugEnum,
  IndustryTemplateSchema,
  ModuleDefinitionSchema,
  DashboardMenuItemSchema,
  SelectIndustryInputSchema,
  UpdateEnabledModulesInputSchema,
  CORE_MODULES,
  INDUSTRY_MODULES,
  MODULE_ICONS,
  MODULE_PATHS,
  MODULE_NAMES,
  buildDashboardMenu,
  getDefaultModulesForIndustry,
  type IndustrySlug,
  type ModuleSlug,
  type IndustryTemplate,
  type ModuleDefinition,
  type DashboardMenuItem,
  type SelectIndustryInput,
  type UpdateEnabledModulesInput,
} from "./industry"
