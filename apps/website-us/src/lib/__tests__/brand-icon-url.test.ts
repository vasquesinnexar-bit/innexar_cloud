import { brandIconUrl } from '@/lib/brand-icon-url'

describe('brandIconUrl', () => {
  it('uses legacy simple-icons version for AWS', () => {
    expect(brandIconUrl('amazonaws')).toContain('simple-icons@11.15.0')
    expect(brandIconUrl('amazonaws')).toContain('/icons/amazonaws.svg')
  })

  it('uses current simple-icons version for icons still in latest', () => {
    expect(brandIconUrl('docker')).toContain('simple-icons@16.14.0')
    expect(brandIconUrl('docker')).toContain('/icons/docker.svg')
  })
})
