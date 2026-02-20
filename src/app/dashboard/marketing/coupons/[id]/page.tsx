import CouponForm from "../components/coupon-form"

interface EditCouponPageProps {
    params: Promise<{ id: string }>
}

export default async function EditCouponPage({ params }: EditCouponPageProps) {
    const { id } = await params

    return <CouponForm couponId={id} />
}
