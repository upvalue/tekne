import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/open/$title')({
    component: RouteComponent,
})

/**
 * This component helps work around some complexity in 
 * the main $title route by simply redirecting, while
 * forcing that document to be unmounted
 */
function RouteComponent() {

    const navigate = useNavigate();
    const title = Route.useParams({
        select: (p) => p.title,
    })

    useEffect(() => {
        navigate({
            to: '/n/$title',
            params: {
                title: title,
            },
            replace: true,
        })
    }, [navigate, title])

    return null;
}
