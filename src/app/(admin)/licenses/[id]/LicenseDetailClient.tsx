import type { License } from '../_lib/types'
import LicenseDetailHeader from '../_components/LicenseDetailHeader'
import RevokedBanner from '../_components/RevokedBanner'
import LicenseMetadataGrid from '../_components/LicenseMetadataGrid'
import LicenseLimits from '../_components/LicenseLimits'
import LicenseFeatures from '../_components/LicenseFeatures'
import LicenseInstancesTable from '../_components/LicenseInstancesTable'
import LicenseAuditEvents from '../_components/LicenseAuditEvents'
import RevokeLicensePanel from '../_components/RevokeLicensePanel'

export default function LicenseDetailClient({ license }: { license: License }) {
  return (
    <div style={{ padding: '32px 32px 0' }}>
      <LicenseDetailHeader license={license} />

      {license.status === 'revoked' && license.revokedAt && (
        <RevokedBanner revokedAt={license.revokedAt} revokeReason={license.revokeReason} />
      )}

      <LicenseMetadataGrid license={license} />
      <LicenseLimits limits={license.limits} />
      <LicenseFeatures features={license.features} />
      <LicenseInstancesTable instances={license.instances} />
      <LicenseAuditEvents events={license.auditEvents} />

      {license.status === 'active' && (
        <RevokeLicensePanel licenseId={license.id} />
      )}

      <div style={{ height: 48 }} />
    </div>
  )
}
