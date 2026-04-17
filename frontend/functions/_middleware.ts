const ALLOWED_IPS = ['125.129.220.253']

export const onRequest: PagesFunction = async (context) => {
  const clientIP = context.request.headers.get('CF-Connecting-IP') ?? ''

  if (!ALLOWED_IPS.includes(clientIP)) {
    return new Response('Access Denied', { status: 403 })
  }

  return context.next()
}
