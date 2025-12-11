import { getProducts } from "./actions"
import { ProductList } from "./components/product-list"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import Link from "next/link" // Added Link import
import { WooImportModal } from "./components/woo-import-modal"
import { DeleteProductButton } from "./components/delete-product-button"
export const dynamic = 'force-dynamic'

// Helper function for currency formatting (assuming it's needed for the new code)
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

export default async function ProductsPage() {
    const result = await getProducts()
    const products = result.success ? result.data : []

    // Placeholder for search, as it's used in the new input field
    const search = '';

    return (
        <DashboardLayout>
            <div className="p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex min-w-72 flex-col">
                        <h1 className="text-text-light-primary dark:text-text-dark-primary text-3xl font-bold tracking-tight">Gestión de Productos</h1>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary text-base font-normal leading-normal mt-1">Añade, edita y gestiona todos los productos de tu tienda.</p>
                    </div>
                    <div className="flex gap-3">
                        <WooImportModal />
                        <Link href="/dashboard/products/new" className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-4 text-white text-sm font-bold shadow-sm hover:bg-primary/90">
                            <span className="material-symbols-outlined text-lg">add_circle</span>
                            <span className="truncate">Añadir Nuevo Producto</span>
                        </Link>
                    </div>
                </div>
                <div className="mt-8 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden">
                    <div className="p-6 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <label className="relative flex items-center w-full max-w-xs">
                                <span className="material-symbols-outlined absolute left-3 text-text-light-secondary dark:text-text-dark-secondary text-xl">search</span>
                                <input
                                    className="form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent h-10 placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary pl-10 text-sm font-normal"
                                    placeholder="Buscar por nombre o SKU"
                                    defaultValue={search}
                                />
                            </label>
                            <button className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-4 text-text-light-secondary dark:text-text-dark-secondary text-sm font-medium hover:bg-background-light dark:hover:bg-background-dark">
                                <span className="material-symbols-outlined text-lg">filter_list</span>
                                <span className="truncate">Filtrar</span>
                            </button>
                        </div>
                    </div>
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-text-light-secondary dark:text-text-dark-secondary uppercase bg-background-light dark:bg-background-dark">
                                <tr>
                                    <th className="px-6 py-3" scope="col">Producto</th>
                                    <th className="px-6 py-3" scope="col">SKU</th>
                                    <th className="px-6 py-3" scope="col">Precio</th>
                                    <th className="px-6 py-3" scope="col">Stock</th>
                                    <th className="px-6 py-3" scope="col">Estado</th>
                                    <th className="px-6 py-3" scope="col">
                                        <span className="sr-only">Acciones</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.length === 0 ? (
                                    <tr className="border-b border-border-light dark:border-border-dark">
                                        <td colSpan={6} className="px-6 py-8 text-center text-text-light-secondary dark:text-text-dark-secondary">
                                            No hay productos encontrados
                                        </td>
                                    </tr>
                                ) : (
                                    products.map((product) => (
                                        <tr key={product.id} className="border-b border-border-light dark:border-border-dark hover:bg-background-light/50 dark:hover:bg-background-dark/50">
                                            <th className="px-6 py-4 font-medium text-text-light-primary dark:text-text-dark-primary whitespace-nowrap" scope="row">
                                                {product.name}
                                            </th>
                                            <td className="px-6 py-4 text-text-light-secondary dark:text-text-dark-secondary">
                                                {product.sku || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-text-light-primary dark:text-text-dark-primary font-semibold">
                                                {formatCurrency(product.price)}
                                            </td>
                                            <td className={`px-6 py-4 font-medium ${product.stock === 0 ? 'text-danger' : 'text-text-light-primary dark:text-text-dark-primary'}`}>
                                                {product.stock}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full ${product.is_active
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                                                    }`}>
                                                    {product.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                                <Link href={`/dashboard/products/${product.id}`} className="p-2 text-text-light-secondary dark:text-text-dark-secondary hover:text-primary dark:hover:text-primary">
                                                    <span className="material-symbols-outlined">edit</span>
                                                </Link>
                                                <DeleteProductButton
                                                    productId={product.id}
                                                    productName={product.name}
                                                />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-6 flex items-center justify-between">
                        <span className="text-sm font-normal text-text-light-secondary dark:text-text-dark-secondary">
                            Mostrando <span className="font-semibold text-text-light-primary dark:text-text-dark-primary">1-{products.length}</span> de <span className="font-semibold text-text-light-primary dark:text-text-dark-primary">{products.length}</span>
                        </span>
                        {/* Pagination placeholder matching prototype */}
                        <div className="inline-flex items-center -space-x-px text-sm">
                            <button className="flex items-center justify-center px-3 h-8 ml-0 leading-tight text-text-light-secondary bg-card-light border border-border-light rounded-l-lg hover:bg-background-light hover:text-text-light-primary dark:bg-card-dark dark:border-border-dark dark:text-text-dark-secondary dark:hover:bg-background-dark dark:hover:text-white">Anterior</button>
                            <button className="flex items-center justify-center px-3 h-8 text-primary bg-primary/20 border border-primary hover:bg-primary/30 hover:text-primary dark:border-primary dark:text-white dark:hover:bg-primary/90 dark:hover:text-white">1</button>
                            <button className="flex items-center justify-center px-3 h-8 leading-tight text-text-light-secondary bg-card-light border border-border-light rounded-r-lg hover:bg-background-light hover:text-text-light-primary dark:bg-card-dark dark:border-border-dark dark:text-text-dark-secondary dark:hover:bg-background-dark dark:hover:text-white">Siguiente</button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
