import { beforeEach } from 'vitest'
import { __resetForTesting } from '@/lib/ratelimit'

beforeEach(() => {
  __resetForTesting()
})
