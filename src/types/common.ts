/**
 * Common types for server actions and API responses
 * Used across the application for consistent error handling and pagination
 */

/**
 * Standardized result type for all server actions
 * Ensures consistent success/failure handling across the codebase
 *
 * @template T - The type of data returned on success (defaults to void)
 *
 * @example
 * // Success case
 * return { success: true, data: { id: "123" } }
 *
 * // Failure case with field errors
 * return {
 *   success: false,
 *   error: "Validation failed",
 *   fieldErrors: { name: ["Name is required"] }
 * }
 */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }

/**
 * Parameters for paginated queries
 */
export interface PaginationParams {
  /** Current page number (1-indexed) */
  page: number
  /** Number of items per page */
  pageSize: number
}

/**
 * Wrapper for paginated data responses
 *
 * @template T - The type of items in the data array
 */
export interface PaginatedResult<T> {
  /** Array of items for the current page */
  data: T[]
  /** Total number of items across all pages */
  total: number
  /** Current page number (1-indexed) */
  page: number
  /** Number of items per page */
  pageSize: number
  /** Total number of pages */
  totalPages: number
}

/**
 * Helper function to create a success result
 */
export function success<T>(data: T): ActionResult<T> {
  return { success: true, data }
}

/**
 * Helper function to create a failure result
 */
export function failure(
  error: string,
  fieldErrors?: Record<string, string[]>
): ActionResult<never> {
  return { success: false, error, fieldErrors }
}
