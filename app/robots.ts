import type { MetadataRoute } from 'next'
import { SITE_URL, absolute } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] }],
    sitemap: absolute('/sitemap.xml'),
    host: SITE_URL,
  }
}
