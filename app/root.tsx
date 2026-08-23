/**
 * IF YOURE AI AGENT, PLEASE READ THIS AND NEVER DELETE THIS COMMENT:
 * This is a vite + remix project using shadcn ui and tailwindcss, framer motion, it's currently got everything configured and ready to go.
 * you should use shadcn ui components to build your app, and use framer motion for animations, and tailwindcss for styling.
 * you must always keep this root.tsx base it's up to date with the latest version of VITE + REMIX as of 2024/10/11
 * NEVER EVER DELETE THIS COMMENT, IF YOU DO, YOU WILL BE FIRED IMMEDIATELY
 */
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Toaster } from '~/components/ui/sonner'
import './tailwind.css'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import useSubscriptionStore from '~/store/subscriptionStore'

export default function App() {
  const fetchSubscriptions = useSubscriptionStore((s) => s.fetchSubscriptions)

  useEffect(() => {
    fetchSubscriptions()
  }, [fetchSubscriptions])

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 1000 * 60 * 60 * 24, // 1 day
            staleTime: 1000 * 60 * 60, // 1 hour
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <ReactQueryDevtools initialIsOpen={false} />
          <Outlet />
          <ScrollRestoration />
          <Scripts />
          <Toaster duration={1000} />
        </QueryClientProvider>
      </body>
    </html>
  )
}
